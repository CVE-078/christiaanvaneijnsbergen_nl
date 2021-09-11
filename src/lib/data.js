const projects = [
    {
        id: 0,
        name: 'Personal website',
        description: 'Consectetur ullamco qui Lorem ad culpa sit do cupidatat nostrud duis ad et. Exercitation cupidatat consequat deserunt amet commodo sit velit labore amet mollit officia. Esse et quis irure sunt voluptate quis. Exercitation sunt eiusmod aute cillum proident sunt cillum. Labore adipisicing deserunt cillum dolor anim cupidatat in velit quis sunt esse id.\r\n',
        preview: 'https://cve-personal.netlify.app/',
        github: 'https://github.com/CVE-078/personal-website',
        type: 'Website',
        stack: ['React', 'SCSS', 'BEM'],
        picture: '/assets/images/projects/v7RfA1q.png'
    },
    {
        id: 1,
        name: 'Airbnb Clone',
        description: 'Dolore amet occaecat mollit mollit dolore. Et do anim est labore voluptate dolore nulla proident. Ipsum anim esse magna dolore quis ullamco consequat est ullamco nulla. Non eu consequat incididunt ut mollit pariatur irure officia. Eu commodo ad aliqua fugiat mollit amet.\r\n',
        preview: 'https://airbnb-clone-react.vercel.app/',
        github: 'https://github.com/CVE-078/airbnb-clone-react',
        type: 'Clone',
        stack: ['Next.js', 'Tailwind CSS', 'API'],
        picture: '/assets/images/projects/Wg58djZ.jpg'
    },
    {
        id: 2,
        name: 'F1 Game Leaderboard',
        description: 'Incididunt aliqua amet officia nostrud adipisicing velit fugiat ad qui ex anim anim ad. Labore occaecat do excepteur labore cillum sit ut mollit anim magna exercitation laboris et magna. Ad officia enim ipsum aliqua minim voluptate officia duis et adipisicing esse. Aliqua amet minim et dolore occaecat. Fugiat sint et ullamco laboris quis magna proident amet id velit nulla culpa. Id ullamco occaecat adipisicing consequat magna ea magna culpa culpa deserunt mollit velit eiusmod.\r\n',
        preview: 'https://f1-intermix.netlify.app/',
        github: 'https://github.com/CVE-078/f1-leaderboard',
        type: 'Application',
        stack: ['Vue.js', 'Firebase', 'Tailwind CSS', 'SCSS', 'BEM'],
        picture: '/assets/images/projects/hDC6DoO.jpg'
    }
]

const jobs = [
    {
        id: 0,
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Web Developer',
        location: 'Sliedrecht, Netherlands',
        startDate: 'September 2019',
        endDate: 'Present',
        description: ''
    },
    {
        id: 1,
        company: 'Dutch Blue',
        url: 'https://www.dutchblue.nl/',
        title: 'Full Stack Developer',
        location: 'Dordrecht, Netherlands',
        startDate: 'March 2019',
        endDate: 'August 2019',
        description: ''
    },
    {
        id: 2,
        company: 'B.made',
        url: 'https://www.bmade.nl/',
        title: 'Service Developer',
        location: 'Rotterdam, Netherlands',
        startDate: 'August 2018',
        endDate: 'February 2019',
        description: ''
    },
    {
        id: 3,
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Web Developer',
        location: 'Sliedrecht, Netherlands',
        startDate: 'March 2015',
        endDate: 'July 2018',
        description: ''
    },
    {
        id: 4,
        company: 'Intermix',
        url: 'https://www.intermix.nl/',
        title: 'Internship',
        location: 'Sliedrecht, Netherlands',
        startDate: 'September 2014',
        endDate: 'February 2015',
        description: ''
    }
]

const menu = [
    {
        id: 0,
        name: 'about',
        link: '#about',
        type: 'link'
    },
    {
        id: 1,
        name: 'jobs',
        link: '#jobs',
        type: 'link'
    },
    {
        id: 2,
        name: 'projects',
        link: '#projects',
        type: 'link'
    },
    {
        id: 3,
        name: 'say hello!',
        link: '#contact',
        type: 'button'
    },
]

const socials = [
    {
        id: 0,
        name: 'LinkedIn',
        url: 'https://www.linkedin.com/in/christiaan-van-eijnsbergen/',
        icon: 'fab fa-fw fa-linkedin-in'
    },
    {
        id: 1,
        name: 'Github',
        url: 'https://github.com/CVE-078',
        icon: 'fab fa-fw fa-github'
    }
]

const titles = ['a 27-year-old', 'an avid gamer', 'a problem solver', 'a father-of-one', 'a tv series binger', 'a web developer']

const about = `
    <p>Hello, nice to meet you!</p>

    <p>I am Christiaan van Eijnsbergen, a 27-year-old, Web Developer with a passion for Front-End development.</p>

    <p>
        My interest for programming began after being on my dad's computer (perhaps too often..) back in the day - in all honesty, mainly to play games.
        Choosing to study computer science came quite natural due to the amount of time spent on the computer, only to realise in high school that I was actually thoroughly enjoying it.
    </p>

    <p>My goals are to bring ideas and designs to life and create websites and applications users will have a great experience using.</p>

    <p>
        I am currently employed at <a href="https://www.intermix.nl/" target="_blank" rel="noopener noreferrer" class="link link--external">Intermix</a> as a Full-Stack Web Developer, developing and maintaining their custom-built Content Management System and also creating awesome new websites for customers.
    </p>
`

export { projects, jobs, menu, socials, titles, about }