import About from '@/components/about';
import Experience from '@/components/experience';
import Header from '@/components/header';
import Hero from '@/components/hero';
import Footer from '@/components/footer';

const Home = () => (
    <div className="flex flex-col min-h-dvh bg-white">
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
