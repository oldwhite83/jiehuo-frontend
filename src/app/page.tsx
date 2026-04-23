import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9F6F0] text-[#333333] font-serif px-4">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')] pointer-events-none"></div>

      <div className="z-10 flex flex-col items-center justify-center space-y-12 sm:space-y-16">
        <h1 className="text-2xl sm:text-4xl tracking-[0.2em] sm:tracking-[0.3em] font-light text-[#2C2C2C] text-center">
          一叶知秋，解惑于心
        </h1>

        <p className="text-base sm:text-lg text-gray-500 tracking-widest">
          施主，今日有何所求？
        </p>

        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 sm:space-x-12 mt-6 sm:mt-10">
          <Link
            href="/chat"
            className="group relative px-8 py-3 border border-gray-400 hover:border-gray-800 transition-colors duration-500 text-center"
          >
            <span className="tracking-widest">随便逛逛</span>
            <div className="absolute inset-0 bg-black scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 -z-10"></div>
            <span className="absolute inset-0 flex items-center justify-center tracking-widest text-transparent group-hover:text-white transition-colors duration-500 pointer-events-none">
              随便逛逛
            </span>
          </Link>

          <Link
            href="/ask"
            className="group relative px-8 py-3 border border-gray-400 hover:border-gray-800 transition-colors duration-500 text-center"
          >
            <span className="tracking-widest">需要解惑</span>
            <div className="absolute inset-0 bg-black scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 -z-10"></div>
            <span className="absolute inset-0 flex items-center justify-center tracking-widest text-transparent group-hover:text-white transition-colors duration-500 pointer-events-none">
              需要解惑
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
