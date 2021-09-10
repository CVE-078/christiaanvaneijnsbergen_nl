import React from 'react'
import './Project.scss'

const Project = ({ project }) => {
    return (
        <div className="project fade-in">

            <div className="project__left">
                <div className="project__imageHolder">
                    <span className={'project__label project__label--' + project.type.toLowerCase()}>{project.type}</span>

                    <img className="project__image" src={project.picture} alt={project.name} />
                </div>
            </div>

            <div className="project__right">
                <h3 className="project__title">{project.name}</h3>

                <div className="project__links">
                    {project.github &&
                        <a href={project.github} rel="noreferrer" target="_blank" className="project__link">
                            <i className="fas fa-fw fa-external-link-alt project__icon"></i>
                        </a>
                    }

                    {project.preview &&
                        <a href={project.preview} rel="noreferrer" target="_blank" className="project__link">
                            <i className="fab fa-fw fa-github project__icon"></i>
                        </a>
                    }
                </div>

                {
                    project.stack &&

                    <ul className="project__stackList">
                        {project.stack.map((stack, index) => (

                            <li
                                key={index}
                                className="project__stackItem"
                            >
                                {stack}
                            </li>

                        ))}
                    </ul>
                }
            </div>
        </div>
    )
}

export default Project
