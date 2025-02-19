import Link from 'next/link';
import * as React from 'react';
import { Github01Icon, Linkedin02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

interface Social {
    id: number;
    name: string;
    url: string;
    icon: React.JSX.Element;
}

const socials: Social[] = [
    {
        id: 0,
        name: 'LinkedIn',
        url: 'https://www.linkedin.com/in/christiaan-van-eijnsbergen/',
        icon: <HugeiconsIcon icon={Linkedin02Icon} size={32} strokeWidth={0.2} />,
    },
    {
        id: 1,
        name: 'Github',
        url: 'https://github.com/CVE-078',
        icon: <HugeiconsIcon icon={Github01Icon} size={32} strokeWidth={0.2} />,
    },
];

const Footer = () => (
    <footer className="relative py-14 bg-gray lg:py-40 px-6">
        <span id="contact" className="h-px -m-px overflow-hidden p-0 absolute whitespace-nowrap w-px border-0 -top-20">
            &nbsp;
        </span>

        <div className="md:container mx-auto transition-all duration-400">
            <div className="flex flex-col justify-center items-start gap-10 md:!gap-14">
                <div className="flex flex-col justify-center items-start gap-10">
                    <h2 className="text-black inline-block font-bold text-xl md:text-3xl relative before:content-[''] before:bg-secondary before:h-1 before:absolute before:-top-4 before:left-0 before:z-0 before:w-1/2">
                        get in touch
                    </h2>

                    <div className="md:text-lg flex flex-col gap-4">
                        <p>have any question you want to ask or perhaps just want to say hi?</p>
                        <p>
                            feel free to shoot me a message on{' '}
                            <Link
                                href="https://www.linkedin.com/in/christiaan-van-eijnsbergen/"
                                target="_blank"
                                className="relative text-secondary leading-snug inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:bg-secondary after:h-0.5 after:transition-all after:duration-400 hover:after:w-full">
                                LinkedIn
                            </Link>{' '}
                            or by sending me a{' '}
                            <Link
                                href="mailto:christiaanvaneijnsbergen@gmail.com"
                                target="_blank"
                                className="relative text-secondary leading-snug inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:bg-secondary after:h-0.5 after:transition-all after:duration-400 hover:after:w-full">
                                mail
                            </Link>
                            .
                        </p>
                    </div>

                    <div className="inline-flex gap-2">
                        {socials.map((social, index) => (
                            <a
                                key={index}
                                href={social.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={social.name}
                                className="relative text-secondary leading-snug inline-block hover:text-primary transition-all duration-400">
                                <span className="sr-only">{social.name}</span>
                                {social.icon}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </footer>
);

export default Footer;
