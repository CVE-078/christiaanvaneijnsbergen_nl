import React from 'react'
import './Project.scss'

const Project = ({ project }) => {
    const { name, preview, github, type, stack, picture } = project;

    return (
        <div className="project fade-in">

            <div className="project__left">
                <div className="project__imageHolder">
                    <span className={'project__label project__label--' + type.toLowerCase()}>{type}</span>

                    <img className="project__image" src={picture} alt={name} />
                </div>
            </div>

            <div className="project__right">
                <h3 className="project__title">{name}</h3>

                {stack ? (
                    <ul className="project__stackList">
                        {stack.map((stack, index) => (

                            <li key={index} className="project__stackItem">
                                <span className="project__stackText">{stack}</span>
                            </li>

                        ))}
                    </ul>
                ) : null}

                <div className="project__links">
                    {github ? (
                        <a
                            href={github}
                            rel="noreferrer"
                            target="_blank"
                            className="project__link"
                            alt={'Check out the source code of ' + name + ' on GitHub'}
                            title={'Check out the source code of ' + name + ' on GitHub'}
                        >
                            <i className="fab fa-fw fa-github project__icon"></i>
                        </a>
                    ) : null}

                    {preview && name !== 'Personal website' ? (
                        <a
                            href={preview}
                            rel="noreferrer"
                            target="_blank"
                            className="project__link"
                            alt={'Check out the live preview of ' + name}
                            title={'Check out the live preview of ' + name}
                        >
                            <i className="fas fa-fw fa-external-link-alt project__icon"></i>
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default Project
