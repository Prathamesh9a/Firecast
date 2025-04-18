import React from 'react';
import Background from '../assets/backgroundImg.png'
import './footer.css';

const Footer = () => {
    return (
        <footer
            className="bgCont bg-cover bg-center w-full flex items-center justify-center text-white pt-16 pb-12 px-4 lg:h-80 pt-24 pb-20 px-4 md:h-60 pt-22 pb-20"
            style={{
                backgroundImage: `url(${Background})`, // Ensure this path points to your image in the public folder
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'fixed', // Keeps it at the bottom of the viewport
                bottom: 0,
                left: 0,
                width: '100%',
                height: '295px', // Adjust height as needed
                zIndex: 0, // Lower z-index to sit behind content
            }}
        >
        </footer>
    );
};

export default Footer;


// import React from 'react';
// import Background from '../assets/backgroundImg.png';
// import './footer.css';

// const Footer = () => {
//     return (
//         <footer
//             className="bg-cover bg-center w-full flex items-center justify-center text-white px-4 pt-16 pb-12 lg:pt-24 lg:pb-20 lg:h-80 md:pt-22 md:pb-20 md:h-60"
//             style={{
//                 backgroundImage: `url(${Background})`,
//             }}
//         >
//             <div className="text-center">
//                 <h2 className="text-2xl font-bold">Footer Section</h2>
//                 <p className="text-sm mt-4">Your footer content goes here</p>
//             </div>
//         </footer>
//     );
// };

// export default Footer;
