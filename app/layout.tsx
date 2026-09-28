import type { Metadata } from 'next';
import './globals.css';
import './game-ui.css';
import './start-screens.css';
export const metadata:Metadata={title:'타운그리드 · TownGrid',description:'빈 땅에서 산업을 키우는 3D 타일 경영 게임',icons:{icon:[{url:'/favicon.ico?v=town-grid-1',sizes:'any',type:'image/x-icon'},{url:'/favicon.svg?v=town-grid-1',type:'image/svg+xml'},{url:'/assets/brand/towngrid-icon-32.png',sizes:'32x32',type:'image/png'},{url:'/assets/brand/towngrid-icon-512.png',sizes:'512x512',type:'image/png'}],apple:{url:'/assets/brand/towngrid-icon-180.png',sizes:'180x180',type:'image/png'}}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>;}
