import * as React from 'react';

interface Hamburger {
    openMenu: boolean;
    setOpenMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

const Hamburger = ({ openMenu, setOpenMenu }: Hamburger) => (
    <div className="sm:hidden relative cursor-pointer" onClick={() => setOpenMenu((prevState) => !prevState)}>
        <div
            className={`flex flex-col justify-center h-10 w-10 transition-all duration-400 ${
                openMenu ? 'gap-2 text-white' : 'gap-1.5 text-primary'
            }`}>
            <span
                className={`h-1 transition-all duration-400 w-1/2 ${
                    openMenu ? 'bg-white origin-bottom rotate-45 translate-x-1 translate-y-1' : 'bg-primary'
                }`}></span>
            <span
                className={`h-1 transition-all duration-400 w-full ${
                    openMenu ? 'bg-white origin-top -rotate-45' : 'bg-primary'
                }`}></span>

            <span
                className={`h-1 transition-all duration-400 w-3/4 ${
                    openMenu
                        ? 'bg-white origin-bottom !w-1/2 rotate-45 translate-x-[18px] -translate-y-1.5'
                        : 'bg-primary'
                }`}></span>
        </div>
    </div>
);

export default Hamburger;
