import React from 'react'
import './ExperienceItem.scss'

const ExperienceItem = ({ item }) => {
    const { title, url, company, startDate, endDate, stack } = item;

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

            {stack ? (
                    <ul className="experience-item__stackList">
                        {stack.map((stack, index) => (

                            <li key={index} className="experience-item__stackItem">
                                <span className="experience-item__stackText">{stack}</span>
                            </li>

                        ))}
                    </ul>
                ) : null}
        </div>
    )
}

export default ExperienceItem