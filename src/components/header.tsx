import Logo from './logo';
import Navigation from './navigation';

const Header = () => (
    <div className="py-4 md:py-5 lg:p-8 fixed top-0 bg-white z-10 border-t-primary w-full md:border-t-30 border-t-20">
        <div className="md:container mx-auto">
            <div className="flex flex-row items-center justify-between">
                <Logo />
                <Navigation />
            </div>
        </div>
    </div>
);

export default Header;
