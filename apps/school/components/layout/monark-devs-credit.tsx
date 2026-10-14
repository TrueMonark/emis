/** "Powered by Monark Devs" with the logo — for the sign-in pages and other public screens. */
export function MonarkDevsCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static brand mark */}
      <img src="/brand/monark-devs-logo.png" alt="Monark Devs" width={56} height={56} className="size-14" />
      <p className="text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-foreground">Monark Devs</span>
        <br />© {new Date().getFullYear()} Monark Devs, Zambia
      </p>
    </div>
  );
}
