import Link from 'next/link';

const Footer = () => (
    <footer className="relative py-14 bg-grey lg:py-40 px-6">
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
                            <Link href="https://www.linkedin.com/in/christiaan-van-eijnsbergen/" target="_blank">
                                LinkedIn
                            </Link>{' '}
                            or by sending me a{' '}
                            <Link href="mailto:christiaanvaneijnsbergen@gmail.com" target="_blank">
                                mail
                            </Link>
                            .
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </footer>
);

export default Footer;
