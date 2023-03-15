import React from 'react'
import ExperienceItem from './ExperienceItem'
import { experience } from '../lib/data'
import './Experience.scss'

const Experience = () => {
    return (
        <section className="section section--experience">

            <div className="container">
                <span id="experience" className="is-visually-hidden" style={{ top: '-80px' }}>&nbsp;</span>

                <div className="section__wrapper">
                    <h2 className="section__title">experience</h2>

                    <div className="experience">
                        <div className="experience__timeline">

                            {experience ? experience.map((item, index) => (
                                <ExperienceItem key={index} item={item} />
                            )) : null}

                        </div>
                    </div>
                </div>

            </div>

        </section>
    )
}

export default Experience
