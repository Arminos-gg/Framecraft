export function Viewport() {
  return (
    <main className="stage panel" aria-label="Viewport">
      <div className="stagebar">Laptop · 1366×768</div>
      <div className="canvas">
        <div className="device" data-testid="screen" />
      </div>
    </main>
  );
}
