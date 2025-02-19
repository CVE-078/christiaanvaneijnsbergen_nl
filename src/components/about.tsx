import Image from 'next/image';
import Link from 'next/link';

const About = () => (
    <section className="relative py-14 lg:py-24 px-6">
        <div className="md:container mx-auto transition-all duration-400">
            <span
                id="about"
                className="h-px -m-px overflow-hidden p-0 absolute whitespace-nowrap w-px border-0 -top-20">
                &nbsp;
            </span>

            <div className="flex flex-col items-start gap-10">
                <h2 className="text-black inline-block font-bold text-xl md:text-3xl relative before:content-[''] before:bg-secondary before:h-1 before:absolute before:-top-4 before:left-0 before:z-0 before:w-1/2">
                    about me
                </h2>

                <div className="flex flex-col-reverse md:flex-row items-start">
                    <div className="text-sm sm:text-base xl:text-lg basis-3/5 mt-10 md:mt-0 md:mr-12 lg:mr-24 gap-4 flex flex-col">
                        <p>Hello, nice to meet you!</p>

                        <p>
                            I am Christiaan van Eijnsbergen, a 30-year-old, web developer with a passion for front-end
                            development.
                        </p>

                        <p>
                            My interest for programming began after being on my dad&apos;s computer (perhaps too
                            often..) back in the day - in all honesty, mainly to play games. Choosing to study computer
                            science came quite natural due to the amount of time spent on the computer, only to realise
                            in high school that I was actually thoroughly enjoying it.
                        </p>

                        <p>
                            My goals are to bring ideas and designs to life and create websites and applications users
                            will have a great experience using.
                        </p>

                        <p>
                            I am currently employed at{' '}
                            <Link
                                href="https://www.bmade.nl/"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="B.made"
                                className="relative text-secondary leading-snug inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:bg-secondary after:h-0.5 after:transition-all after:duration-400 hover:after:w-full">
                                B.made
                            </Link>{' '}
                            as a front-end developer.
                        </p>
                    </div>

                    <Image
                        src="/assets/me.png"
                        alt="Christiaan van Eijnsbergen"
                        width={200}
                        height={200}
                        className="block max-w-full max-h-64 object-contain md:max-h-full basis-2/5"
                    />
                </div>
            </div>
        </div>
    </section>
);

export default About;
