export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/" + url, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível concluir a operação.");
  return data as T;
}
export const post = (data: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
export function time(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
export type Project = {
  id: string;
  title: string;
  status: string;
  mode: string;
  createdAt: string;
  sourceMetaJson: string | null;
  sourcePath: string;
};
export type Clip = {
  id: string;
  projectId: string;
  rank: number;
  scoreTotal: number;
  edlJson: string;
  status: string;
  previewPath: string | null;
};
export type Job = {
  id: string;
  type: string;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  logJson: string;
  startedAt: string | null;
  finishedAt: string | null;
};
export type Render = {
  id: string;
  clipId: string;
  status: string;
  progress: number;
  path: string | null;
  error: string | null;
  preset: string;
};
