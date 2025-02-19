import About from '@/components/about';
import Experience from '@/components/experience';
import Header from '@/components/header';
import Hero from '@/components/hero';
import Footer from '@/components/footer';

const Home = () => (
    <div className="flex flex-col min-h-dvh bg-white">
        <span id="top" className="h-px -m-px overflow-hidden p-0 absolute whitespace-nowrap w-px border-0 -top-20">
            &nbsp;
        </span>

        <Header />
        <Hero />

        <main className="flex-1">
            <About />
            <Experience />
        </main>

        <Footer />
    </div>
);

export default Home;
