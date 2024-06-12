'use client';

import * as React from 'react';
import Logo from './logo';
import Navigation from './navigation';
import Hamburger from './hamburger';

const Header = () => {
    const [openMenu, setOpenMenu] = React.useState<boolean>(false);

    return (
        <header className="py-4 md:py-5 px-6 lg:py-8 fixed inset-x-5 md:inset-x-8 top-0 bg-white z-10 border-t-primary sm:border-t-32 border-t-20 transition-all duration-400">
            <div className="md:container mx-auto transition-all duration-400">
                <div className="flex flex-row items-center justify-between">
                    <Logo />
                    <Navigation openMenu={openMenu} setOpenMenu={setOpenMenu} />
                    <Hamburger openMenu={openMenu} setOpenMenu={setOpenMenu} />
                </div>
            </div>
        </header>
    );
};

export default Header;
