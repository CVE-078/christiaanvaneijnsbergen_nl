import React from 'react'
import './About.scss'
import './Section.scss'
import me from '../images/me-small.png'

function About() {
    return (
        <section className="section section--about">

            <div className="container">
                <span id="about" className="is-visually-hidden" style={{ top: '-100px' }}>&nbsp;</span>

                <div className="section__wrapper">

                    <h2 className="section__title">about me</h2>

                    <div className="section__columns">

                        <div className="section__column section__column--3/5">
                            <div className="section__richText">
                                <p>Hello, nice to meet you!</p>

                                <p>I am Christiaan van Eijnsbergen, a 27-year-old, Web Developer with a passion for Front-End development.</p>

                                <p>
                                    My interest for programming began after being on my dad's computer (perhaps too often..) back in the day - can't lie, mainly to play games.
                                    Choosing to study computer science came quite natural due to the amount of time spent on the computer, only to realise in high school that I was actually thoroughly enjoying it.
                                </p>

                                <p>My goals are to bring ideas and designs to life and build websites and applications the users will have a great experience using.</p>

                                <p>
                                    Currently working as a Full-Stack Web Developer at <a href="https://www.intermix.nl/" target="_blank" rel="noopener noreferrer" className="link link--external">Intermix</a>, developing and maintaining their custom-built Content Management System and also creating awesome new websites for customers.
                                </p>
                            </div>
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
