import React from 'react'
import './Job.scss'

const Job = ({ job }) => {
    return (
        <div className="job">
            <h3 className="job__title">
                {job.title} @&nbsp;
                <a href={job.url} className="job__link" rel="noreferrer" target="_blank">{job.company}</a>
            </h3>

            <span className="job__range">{job.startDate} - {job.endDate}</span>


        </div>
    )
}

export default Job