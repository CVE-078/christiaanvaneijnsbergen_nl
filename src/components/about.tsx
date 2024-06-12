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
                    about
                </h2>

                <div className="flex justify-center w-full"></div>
            </div>
        </div>
    </section>
);

export default About;
