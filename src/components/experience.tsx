import { experience as data } from '@/lib/experience';
import Link from 'next/link';

const Experience = () => (
    <section className="relative py-14 lg:py-24 px-6">
        <div className="md:container mx-auto transition-all duration-400">
            <span
                id="experience"
                className="h-px -m-px overflow-hidden p-0 absolute whitespace-nowrap w-px border-0 -top-20">
                &nbsp;
            </span>

            <div className="flex flex-col items-start gap-10">
                <h2 className="text-black inline-block font-bold text-xl md:text-3xl relative before:content-[''] before:bg-secondary before:h-1 before:absolute before:-top-4 before:left-0 before:z-0 before:w-1/2">
                    experience
                </h2>

                <div className="flex justify-center w-full">
                    {data ? (
                        <div className="before:top-[69px] before:bottom-[66px] before:bg-primary lg:before:top-[69px] lg:before:bottom-[67px] xl:before:top-[74px] xl:before:bottom-[71px] flex flex-col items-center w-full relative gap-10 before:content-[''] before:w-0.5 before:absolute before:left-1/2 before:-translate-x-1/2 before:z-1">
                            {data.map((item, index) => (
                                <div
                                    key={index}
                                    className={`z-2 bg-grey p-6 flex flex-col flex-1 w-full transition-all duration-400 sm:w-auto gap-2.5 after:content-[''] after:h-0.5 after:w-6 after:absolute after:top-1/2 after:bg-primary after:hidden lg:after:block lg:w-[calc(50%_-_24px)] xl:w-auto xl:max-w-[calc(50%_-_24px)] ${
                                        index % 2 === 0
                                            ? 'lg:ml-12 lg:translate-x-1/2 lg:items-start after:right-full'
                                            : 'lg:mr-12 lg:-translate-x-1/2 lg:items-end after:left-full'
                                    }`}>
                                    <h3 className="lowercase font-bold text-sm sm:text-base md:text-lg xl:text-xl !leading-none">
                                        {item.title} @&nbsp;
                                        <Link
                                            href={item.url}
                                            className="relative text-secondary leading-snug inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:bg-secondary after:h-0.5 after:transition-all after:duration-400 hover:after:w-full"
                                            rel="noreferrer"
                                            target="_blank"
                                            title={item.company}>
                                            {item.company}
                                        </Link>
                                    </h3>

                                    <span className="lowercase text-xs sm:text-sm">
                                        {item.startDate} - {item.endDate}
                                    </span>

                                    {item.stack ? (
                                        <ul
                                            className={`flex flex-row flex-wrap justify-start items-start gap-1.5 lg:gap-2.5 ${
                                                index % 2 === 0 ? '' : 'lg:justify-end'
                                            }`}>
                                            {item.stack.map((stack, index) => (
                                                <li
                                                    key={index}
                                                    className="inline-block border border-primary py-1 px-2.5 text-xxs xl:text-xs relative cursor-default transition-all duration-400 group hover:text-white  after:content-[''] after:bg-primary after:absolute after:inset-y-0 after:left-0 after:w-0 after:z-1 after:transition-all after:duration-400 hover:after:w-full">
                                                    <span className="relative z-2">{stack}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    </section>
);

export default Experience;
