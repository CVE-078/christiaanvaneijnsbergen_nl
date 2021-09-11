import React from 'react'
import { about } from '../lib/data'
import './Section.scss'
import me from '../images/me.png'

const About = () => {
    return (
        <section className="section section--about">

            <div className="container">
                <span id="about" className="is-visually-hidden" style={{ top: '-80px' }}>&nbsp;</span>

                <div className="section__wrapper">

                    <h2 className="section__title">about me</h2>

                    <div className="section__columns">

                        <div className="section__column section__column--3/5">
                            <div className="section__richText" dangerouslySetInnerHTML={{ __html: about }}></div>
                        </div>

                        <div className="section__column section__column--2/5">
                            <img className="section__image" src={me} alt="Me" />
                        </div>

                    </div>

                </div>
            </div>
        </section>
    )
}

export default About
