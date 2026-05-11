import bg from "@/assets/bg.png";

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background/90" />
      {/* floating petals */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-petal"
          style={{
            top: `${Math.random() * 70}%`,
            left: `${Math.random() * 90}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${5 + Math.random() * 5}s`,
          }}
        >
          <span className="block w-3 h-4 rounded-full bg-rose-pink/70 blur-[1px] rotate-45" />
        </div>
      ))}
    </div>
  );
}
