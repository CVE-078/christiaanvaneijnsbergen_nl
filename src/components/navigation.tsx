import { scrollToElement } from '@/utils';

interface Navigation {
    openMenu: boolean;
    setOpenMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

interface NavigationItem {
    name: string;
    link: string;
    type: string;
}

const Navigation = ({ openMenu, setOpenMenu }: Navigation) => {
    const items: NavigationItem[] = [
        {
            name: 'about',
            link: 'about',
            type: 'link',
        },
        {
            name: 'experience',
            link: 'experience',
            type: 'link',
        },
        {
            name: 'say hello!',
            link: 'contact',
            type: 'button',
        },
    ];

    return (
        <nav
            className={`flex md:relative max-sm:fixed max-sm:bg-primary/95 max-sm:inset-0 max-sm:justify-center max-sm:items-center max-sm:translate-x-full transition-all duration-400 max-sm:opacity-0 max-sm:overflow-hidden ${
                openMenu ? 'max-sm:!translate-x-0 max-sm:!opacity-100' : ''
            }`}>
            <ul className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 transition-all duration-400">
                {items.map((item: NavigationItem, index: number) => (
                    <li className="flex-1 basis-auto sm:text-center" key={index}>
                        <a
                            className={`text-white text-xl relative sm:block sm:text-sm md:text-base group hover:text-secondary hover:sm:text-primary transition-all duration-400 cursor-pointer ${
                                item.type === 'button'
                                    ? 'sm:py-2.5 sm:px-6 sm:border sm:border-primary sm:rounded-full overflow-hidden'
                                    : 'sm:py-1.5 sm:text-primary'
                            }`}
                            onClick={() => {
                                scrollToElement(item.link);
                                setOpenMenu(false);
                            }}>
                            <span
                                className={`before:content-[''] before:absolute before:transition-all before:duration-400 before:sm:bg-primary group-hover:before:!w-full ${
                                    item.type === 'button'
                                        ? 'before:max-sm:h-0.5 before:max-sm:bg-secondary before:max-sm:w-0 before:max-sm:-bottom-0.5 before:max-sm:left-0 before:sm:bg-primary before:sm:rounded-full before:sm:opacity-100 before:sm:scale-105 before:sm:inset-0 before:sm:-z-1 group-hover:before:sm:opacity-0'
                                        : 'before:h-0.5 before:bg-secondary before:max-sm:-bottom-0.5 before:sm:bottom-0 before:left-0 before:w-0'
                                }`}>
                                {item.name}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Navigation;
