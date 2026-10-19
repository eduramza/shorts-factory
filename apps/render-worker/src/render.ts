import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  makeCancelSignal,
} from "@remotion/renderer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rename, rm, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { EDL, CatalogAsset } from "../../../packages/edl";
import { config } from "../../../packages/edl";
import { root, safePath } from "../../../packages/core/storage";
const exec = promisify(execFile);
let bundled: Promise<string> | undefined;
export async function renderClip(
  edl: EDL,
  source: string,
  assets: CatalogAsset[],
  key: string,
  preset: string,
  onProgress: (p: number) => void,
  cancelled: () => boolean,
  voicePaths?: { voice: string; clean: string },
) {
  const dimensions =
    preset === "4k"
      ? [2160, 3840]
      : preset === "draft"
        ? [540, 960]
        : [1080, 1920];
  if (!bundled)
    bundled = bundle({
      entryPoint: join(root, "packages/composition/root.tsx"),
    });
  const serveUrl = await bundled;
  const base = process.env.APP_URL || "http://127.0.0.1:3000";
  const sourceProbe = JSON.parse(
    (
      await exec("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        safePath(source),
      ])
    ).stdout,
  ) as { streams: { width: number; height: number }[] };
  const props = {
    edl,
    sourceMeta: sourceProbe.streams[0],
    voiceUrl: voicePaths ? base + "/api/media/" + voicePaths.voice : undefined,
    cleanVoiceUrl: voicePaths
      ? base + "/api/media/" + voicePaths.clean
      : undefined,
    sourceUrl: base + "/api/media/" + source,
    assets: assets.map((a) => ({
      ...a,
      path: a.path ? base + "/api/media/" + a.path : undefined,
    })),
  };
  const composition = await selectComposition({
    serveUrl,
    id: "ShortComposition",
    inputProps: props,
  });
  composition.width = dimensions[0];
  composition.height = dimensions[1];
  const path = safePath(key),
    temporary = path + ".render.mp4",
    normalized = path + ".normalized.mp4";
  await mkdir(dirname(path), { recursive: true });
  const signal = makeCancelSignal();
  const timer = setInterval(() => {
    if (cancelled()) signal.cancel();
  }, 500);
  try {
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      crf: 18,
      imageFormat: "png",
      colorSpace: "bt709",
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioBitrate: "256k",
      outputLocation: temporary,
      inputProps: props,
      concurrency: Number(process.env.RENDER_CONCURRENCY || 1),
      cancelSignal: signal.cancelSignal,
      onProgress: ({ progress }) => onProgress(progress * 90),
    });
    if (cancelled()) throw new Error("Render cancelado.");
    const measurement = await exec(
      "ffmpeg",
      [
        "-i",
        temporary,
        "-af",
        "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const match = measurement.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
    if (!match) throw new Error("Não foi possível medir o loudness.");
    const m = JSON.parse(match[0]) as Record<string, string>;
    await exec("ffmpeg", [
      "-y",
      "-i",
      temporary,
      "-c:v",
      "copy",
      "-bsf:v",
      "h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1",
      "-af",
      `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      "-c:a",
      "aac",
      "-b:a",
      "256k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      normalized,
    ]);
    const probe = JSON.parse(
      (
        await exec("ffprobe", [
          "-v",
          "error",
          "-show_format",
          "-show_streams",
          "-of",
          "json",
          normalized,
        ])
      ).stdout,
    ) as {
      format: { duration: string };
      streams: {
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        pix_fmt: string;
        color_space: string;
      }[];
    };
    const video = probe.streams.find((s) => s.codec_type === "video");
    if (
      video?.width !== dimensions[0] ||
      video?.height !== dimensions[1] ||
      video?.codec_name !== "h264" ||
      video?.pix_fmt !== "yuv420p" ||
      video?.color_space !== "bt709" ||
      !probe.streams.some((s) => s.codec_type === "audio") ||
      Math.abs(Number(probe.format.duration) - edl.duration_out) >
        config.frameTolerance / config.fps
    )
      throw new Error(
        "Pós-render inválido: duração, resolução, codec ou áudio divergem da EDL.",
      );
    await rename(normalized, path);
    onProgress(100);
    return { path: key, size: (await stat(path)).size, probe };
  } finally {
    clearInterval(timer);
    await rm(temporary, { force: true });
    await rm(normalized, { force: true });
  }
}
