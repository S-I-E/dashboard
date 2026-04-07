import Image from "next/image"
import Logo from "@/public/images/logo.svg"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10 relative overflow-hidden">
        {/* Subtle background pattern for the form side */}
        <div className="absolute inset-0 bg-muted/20" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

        <div className="relative z-10 flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium transition-opacity hover:opacity-80">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Image src={Logo} alt="Logo" width={24} height={24} className="size-4" />
            </div>
            SIE
          </a>
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs animate-in fade-in slide-in-from-left-8 duration-700">{children}</div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block overflow-hidden">
        {/* Rich gradient background */}
        <div className="absolute inset-0 bg-linear-to-br from-[#1a2b5e] via-[#0b6cb4] to-[#4a9e58]" />

        {/* Animated grain/noise effect (simulated with pattern) */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 mix-blend-overlay" />

        {/* Decorative glowing orbs */}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-green-400/20 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-white">
          <div className="mb-8 relative group">
            {/* Glassmorphism container */}
            <div className="absolute inset-0 rounded-full bg-white/10 blur-xl transition-all duration-500 group-hover:bg-white/20 group-hover:blur-2xl" />
            <div className="relative rounded-full bg-white/10 p-8 ring-1 ring-white/20 backdrop-blur-md shadow-2xl transition-transform duration-500 group-hover:scale-105">
              <Image src={Logo} alt="Logo" width={200} height={200} className="h-auto w-48 drop-shadow-lg" />
            </div>
          </div>
          <div className="max-w-md text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            <h1 className="mb-4 text-3xl font-bold tracking-tight drop-shadow-md">Secretaria de Inovação e Empreendedorismo</h1>
            <p className="text-lg text-white/90 font-light tracking-wide drop-shadow-sm">Universidade Federal de Rondonópolis</p>
          </div>
        </div>
      </div>
    </div>
  )
}
