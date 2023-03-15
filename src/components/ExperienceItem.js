import React from 'react'
import './ExperienceItem.scss'

const ExperienceItem = ({ item }) => {
    const { title, url, company, startDate, endDate } = item;

    return (
        <div className="experience-item">
            <h3 className="experience-item__title">

                {title} @&nbsp;
                <a
                    href={url}
                    className="experience-item__link"
                    rel="noreferrer"
                    target="_blank"
                    title={company}
                    alt={company}
                >
                    {company}
                </a>

            </h3>

            <span className="experience-item__range">{startDate} - {endDate}</span>
        </div>
    )
}

export default ExperienceItem