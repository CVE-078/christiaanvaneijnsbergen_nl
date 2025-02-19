enum Stack {
    HTML5 = 'HTML5',
    SCSS = 'SCSS',
    JAVASCRIPT = 'JavaScript',
    TYPESCRIPT = 'TypeScript',
    JQUERY = 'jQuery',
    REACT = 'React',
    VUEJS = 'Vue.js',
    NEXTJS = 'Next.js',
    NUXT = 'Nuxt',
    PHP = 'PHP',
    ASP = 'ASP',
    WORDPRESS = 'Wordpress',
    CYPRESS = 'Cypress',
    AGILE = 'Agile',
}

interface Experience {
    company: string;
    url: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    stack: Stack[];
}

const experience: Experience[] = [
    {
        company: 'B.made',
        url: 'https://www.bmade.nl/',
        title: 'Front-end Developer',
        location: 'Rotterdam, Netherlands',
        startDate: 'September 2022',
        endDate: 'Present',
        stack: [Stack.REACT, Stack.NEXTJS, Stack.NUXT, Stack.VUEJS, Stack.TYPESCRIPT, Stack.AGILE],
    },
    {
        company: '123inkt',
        url: 'https://www.123inkt.nl/',
        title: 'Front-end Developer',
        location: 'Nederhorst den Berg, Netherlands',
        startDate: 'February 2022',
        endDate: 'August 2022',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.TYPESCRIPT, Stack.CYPRESS],
    },
    {
        company: 'Software Bastards',
        url: 'https://softwarebastards.nl/',
        title: 'Front-end Developer',
        location: 'Abcoude, Netherlands',
        startDate: 'November 2021',
        endDate: 'December 2021',
        stack: [Stack.HTML5, Stack.SCSS, Stack.TYPESCRIPT, Stack.REACT],
    },
    {
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Web Developer',
        location: 'Sliedrecht, Netherlands',
        startDate: 'September 2019',
        endDate: 'October 2021',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.JQUERY, Stack.VUEJS, Stack.PHP, Stack.ASP],
    },
    {
        company: 'Dutch Blue',
        url: 'https://www.dutchblue.nl/',
        title: 'Full Stack Developer',
        location: 'Dordrecht, Netherlands',
        startDate: 'March 2019',
        endDate: 'August 2019',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.VUEJS, Stack.WORDPRESS],
    },
    {
        company: 'B.made',
        url: 'https://www.bmade.nl/',
        title: 'Service Developer',
        location: 'Rotterdam, Netherlands',
        startDate: 'August 2018',
        endDate: 'February 2019',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.WORDPRESS],
    },
    {
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Web Developer',
        location: 'Sliedrecht, Netherlands',
        startDate: 'March 2015',
        endDate: 'July 2018',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.JQUERY, Stack.PHP, Stack.ASP],
    },
    {
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Internship',
        location: 'Sliedrecht, Netherlands',
        startDate: 'September 2014',
        endDate: 'February 2015',
        stack: [Stack.HTML5, Stack.SCSS, Stack.JAVASCRIPT, Stack.JQUERY, Stack.ASP],
    },
];

export default experience;
