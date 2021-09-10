import React from 'react'
import { menu } from '../lib/data'
import './Navigation.scss'

const Navigation = () => {
    return (
        <nav className="navigation">
            <ul className="navigation__list">

                {menu && menu.map((item) => (
                    <li className="navigation__item">
                        <a href={item.link} className={'navigation__' + item.type + ' link link--anchor'}>{item.name}</a>
                    </li>
                ))}

            </ul>
        </nav>
    )
}

export default Navigation
