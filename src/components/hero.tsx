'use client';

import * as React from 'react';
import IconArrowDown from '@/components/icons/icon-arrow-down';
import { scrollToElement } from '@/utils';

const Hero = () => {
    const [currentItemIndex, setCurrentItemIndex] = React.useState<number>(0);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const sliderRef = React.useRef(null);

    const descriptions: string[] = React.useMemo(() => {
        return [
            '30 years old',
            'an avid gamer',
            'a father of two',
            'a problem solver',
            'a weight-pusher',
            'a tv series binger',
            'a web developer',
            'a Formula 1 watcher',
        ];
    }, []);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setIsLoading(true);

            setTimeout(() => {
                setCurrentItemIndex((index) => (index === descriptions.length - 1 ? 0 : index + 1));
                setIsLoading(false);
            }, 1000);
        }, 3000);
        return () => clearInterval(interval);
    }, [currentItemIndex, descriptions]);

    return (
        <section className="flex flex-col justify-center items-center w-full relative h-dvh px-6">
            <div className="md:container mx-auto transition-all duration-400">
                <div className="flex flex-col items-start justify-center">
                    <span className="sm:text-xl md:text-2xl">Hello, my name is</span>

                    <h1 className="font-bold text-3xl !leading-tight sm:text-4xl md:text-5xl lg:text-7xl text-primary">
                        Christiaan van Eijnsbergen
                    </h1>

                    <span className="flex flex-col items-start sm:text-xl lg:flex-row lg:items-center lg:text-2xl lg:!gap-1.5">
                        I am
                        <span
                            className={`inline-flex border-2 border-primary py-1.5 px-2.5 my-1.5 text-white bg-primary md:my-2.5 text-sm sm:text-base md:text-xl lowercase whitespace-nowrap transition-all duration-300 overflow-hidden ${
                                isLoading ? '!opacity-0 !w-0 !px-0' : ''
                            }`}
                            ref={sliderRef}>
                            {descriptions[currentItemIndex]}
                        </span>
                        located in Sliedrecht, The Netherlands
                    </span>
                </div>

                <div className="absolute left-1/2 bottom-14 md:bottom-20 -translate-x-1/2">
                    <a
                        onClick={() => scrollToElement('about')}
                        title="Find out more"
                        className="inline-flex flex-row items-center text-primary border border-primary rounded-full relative whitespace-nowrap transition-all duration-400 py-2.5 px-6 md:py-4 hover:text-white group gap-4 cursor-pointer">
                        <span className="-z-1 absolute inset-0 rounded-full bg-primary scale-75 opacity-0 transition-all duration-400 group-hover:opacity-100 group-hover:scale-100"></span>
                        <span className="-z-1 text-sm md:text-lg">curious? find out more</span>

                        <span className="h-6 w-6">
                            <IconArrowDown />
                        </span>
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Hero;
