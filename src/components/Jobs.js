import React from 'react'
import { jobs } from '../lib/data'
import Job from './Job'
import './Jobs.scss'

const Jobs = () => {
    return (
        <section className="section section--jobs">

            <div className="container">
                <span id="jobs" className="is-visually-hidden" style={{ top: '-80px' }}>&nbsp;</span>

                <div className="section__wrapper">
                    <h2 className="section__title">jobs</h2>

                    <div className="jobs">
                        <div className="jobs__timeline">

                            {jobs && jobs.map((job, index) => (
                                <Job key={index} job={job} />
                            ))}

                        </div>
                    </div>
                </div>

            </div>

        </section>
    )
}

export default Jobs
