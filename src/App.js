import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './Firebase';
import Auth from './pages/Auth'
import Map from './pages/Map';

//protected Route fundtion( we want to protect MAP.js)

function ProtectedRoute({user, children})
{
  if(user)
  {
    return children;
  }
  else{
    return <Navigate to= "/" />;
  }

}

function App() {
  const[user, setUser] = useState(null); //null because not login yet
  const[loading, setLoading] = useState(true); // because we do not know if user previously logged in
  
  useEffect(()=>{

    const unsubscribe = onAuthStateChanged(auth, (User)=>// ask and listen firebase if this user previously logged in if yes
      {
      setUser(User); // the user get saved
      setLoading(false); // we turn loading off once we know if the user previously logged in
    }); 
    return () =>unsubscribe(); // cleans up listener
  }, []);

  if (loading) return (
  
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-sm">Loading...</p>
    </div>
  );
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} /> {/*show auth page*/}
        <Route path="/map" element={
          <ProtectedRoute user={user}>
            <Map />
          </ProtectedRoute> 
        } />{/*only show the protected page(map)if is a user*/}
      </Routes>
    </BrowserRouter>
  );
}

  


export default App;
