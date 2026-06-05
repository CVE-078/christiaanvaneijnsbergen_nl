// The screen-level page title, matching the Progress header. Used on Plan,
// Library, and Profile so every view (except Train, which leads with its
// context bar) opens with the same heading treatment.
export default function PageTitle({ children }: { children: React.ReactNode }) {
    return (
        <h1 className="font-pulse text-[1.75rem] sm:text-[2.25rem] font-medium tracking-[-0.018em] text-pulse-text">
            {children}
        </h1>
    );
}
