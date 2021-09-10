import React from 'react'
import { menu } from '../lib/data'
import './Navigation.scss'

const Navigation = ({ open, setOpen }) => {

    return (
        <>
            <nav className={`navigation ${open ? 'navigation--show' : ''}`}>
                <span className="navigation__close" onClick={() => setOpen(!open)}>
                    <i className="fas fa-fw fa-2x fa-times navigation__icon"></i>
                </span>

                <ul className="navigation__list">

                    {menu && menu.map((item, index) => (
                        <li key={index} className="navigation__item" onClick={() => setOpen(!open)}>
                            <a href={item.link} className={'navigation__' + item.type + ' link link--anchor'}>{item.name}</a>
                        </li>
                    ))}

                </ul>
            </nav>
        </>
    )

}

export default Navigation
