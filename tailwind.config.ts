import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        colors: {
            primary: '#222831',
            secondary: '#00adb5',
            black: {
                DEFAULT: '#010101',
                dark: '#000000',
            },
            white: '#ffffff',
            grey: {
                DEFAULT: '#eeeeee',
            },
        },
        extend: {
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
            flexBasis: {
                15: '15',
            },
            height: {
                15: '15',
            },
            width: {
                15: '15',
            },
            borderWidth: {
                3: '3px',
                20: '20px',
                30: '30px',
            },
            boxShadow: {
                DEFAULT: '0 4px 5px 0 rgba(0,0,0,.07), 0 1px 10px 0 rgba(0,0,0,.06), 0 2px 4px -1px rgba(0,0,0,.1)',
            },
            flexGrow: {
                2: '2',
            },
            maxHeight: {
                max: '999px',
            },
            transitionDuration: {
                400: '400ms',
            },
            zIndex: {
                1: '1',
                2: '2',
                3: '3',
                4: '4',
                5: '5',
                6: '6',
                7: '7',
                8: '8',
                9: '9',

                60: '60',
                70: '70',
                80: '80',
                90: '90',
                100: '100',
            },
        },
    },
};
export default config;
