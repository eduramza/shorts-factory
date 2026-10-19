"use client";
import { Button } from "../components/ui/button";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <h1>Não foi possível abrir o estúdio</h1>
      <p role="alert">{error.message}</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
