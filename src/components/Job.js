import React from 'react'
import './Job.scss'

const Job = ({ job }) => {
  const { title, url, company, startDate, endDate } = job;

  return (
    <div className="job">
      <h3 className="job__title">

        {title} @&nbsp;
        <a
          href={url}
          className="job__link"
          rel="noreferrer"
          target="_blank"
          title={company}
          alt={company}
        >
          {company}
        </a>

      </h3>

      <span className="job__range">{startDate} - {endDate}</span>
    </div>
  )
}

export default Job