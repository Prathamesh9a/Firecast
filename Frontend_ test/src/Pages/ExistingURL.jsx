import React from 'react';
import Header from './Header';
// import URLList from './components/URLList';
import Footer from './Footer';
import EditUrl from './EditUrl';

const ExistingURL = () => (
  <div className="flex flex-col h-screen bg-[#f1f1f1]" >
    <Header />
    <main className="flex-grow overflow-y-auto" >
      {/* <URLList /> */}
      <EditUrl/>
    </main>
    <Footer />
  </div>
);

export default ExistingURL;
