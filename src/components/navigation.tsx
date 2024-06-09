import Link from 'next/link';

interface NavigationItem {
    name: string;
    link: string;
    type: string;
}

const Navigation = () => {
    const items: NavigationItem[] = [
        {
            name: 'about',
            link: '#about',
            type: 'link',
        },
        {
            name: 'experience',
            link: '#experience',
            type: 'link',
        },
        {
            name: 'say hello!',
            link: '#contact',
            type: 'button',
        },
    ];

    return (
        <nav className="flex md:relative">
            <ul className="flex flex-col md:flex-row items-center">
                {items.map((item: NavigationItem, index: number) => (
                    <li className="flex-1 basis-auto sm:text-center" key={index}>
                        <Link
                            className="text-white text-xl relative sm:block sm:py-1.5 sm:mx-6 sm:text-sm sm:text-primary md:text-base group hover:text-secondary hover:sm:text-primary"
                            href={item.link}>
                            <span className="before:content-[''] before:h-0.5 before:bg-secondary before:w-0 before:absolute before:bottom-0 before:left-0 before:transition-all before:duration-400 before:sm:bg-primary group-hover:before:w-full">
                                {item.name}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Navigation;
