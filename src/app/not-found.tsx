import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-6 text-center">
      <span className="text-secondary font-bold text-8xl md:text-9xl">404</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl md:text-3xl text-primary">Page not found</h1>
        <p className="text-primary/60 md:text-lg">The page you are looking for does not exist.</p>
      </div>
      <Link
        href="/"
        className="relative text-secondary leading-snug inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:bg-secondary after:h-0.5 after:transition-all after:duration-400 hover:after:w-full">
        ← Back to home
      </Link>
    </div>
  );
}
