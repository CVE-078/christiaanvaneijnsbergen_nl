import React, { useEffect } from 'react'
import { titles } from '../lib/data'
import './Hero.scss'

const Hero = () => {
    const slideTitles = () => {
        const sliderText = document.getElementsByClassName('hero__sliderText')[0];
        let i = 0

        setInterval(() => {
            sliderText.classList.add('hero__sliderText--hide');

            setTimeout(() => {
                sliderText.innerHTML = titles[i];
                sliderText.classList.remove('hero__sliderText--hide');
            }, 750);

            i = (i + 1) % titles.length
        }, 3000);

    }

    useEffect(() => {
        slideTitles();
    }, []);

    return (
        <section className="hero hero--fullscreen fade-in">
            <div className="container">
                <span id="top" className="is-visually-hidden" style={{ top: '-80px' }}>&nbsp;</span>

                <div className="hero__wrapper">
                    <span className="hero__prefix">Hello, my name is</span>

                    <h1 className="hero__title">Christiaan van Eijnsbergen</h1>

                    <span className="hero__description">
                        I am
                        <span className="hero__slider">
                            <span className="hero__sliderText">{titles[0]}</span>
                        </span>
                        located in Dordrecht, The Netherlands
                    </span>
                </div>

                <div className="hero__learnMore">

                    <a href="/#about" className="hero__button link link--anchor" title="Find out more" alt="Find out more">
                        <span className="hero__buttonText">curious? find out more</span>
                        <i className="fas fa-fw fa-arrow-down hero__buttonIcon"></i>
                    </a>

                </div>

            </div>
        </section>
    )
}

export default Hero
