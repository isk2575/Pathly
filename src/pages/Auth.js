import React, {useState} from "react";
import{
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
} from "firebase/auth";

import {auth} from "../Firebase";

const provider = new GoogleAuthProvider()//when someone clicks the Google button, use Google as the login method."

export default function Auth()
{
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [ password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const handleEmailAuth = async (e) =>
    {
        e.preventDefault(); // prevent the form from refreshing the page when submitted
        setError(""); // clear previous error

        if(!isLogin) // for register mode( not login)
        {
            if(password !== confirmPassword) 
            {
                setError ("passwords do not match");
                return;
            }
        }
        setLoading(true);
        try{
            if(isLogin)
            {
                await signInWithEmailAndPassword(auth, email, password);
            }
            else{
                await createUserWithEmailAndPassword(auth, email, password);
            }
        }
        catch(err)
        {
            setError(getFriendlyError(err.code));

        }
        finally{
            setLoading (false);
        }


    };

    const handleGoogleAuth = async() =>
    {
        setError("");
        setLoading(true);
        try{
            await signInWithPopup(auth, provider)
            //redirect after successful auth

        }
        catch(err){
            setError(getFriendlyError(err.code));

        }
        finally{
            setLoading(false);

        }
    };

    const getFriendlyError = (code) => {
    if (code === "auth/user-not-found") return "No account found ";
    if (code === "auth/wrong-password") return "Incorrect password or email. Please try again.";
    if (code === "auth/email-already-in-use") return "An account with this email already exists.";
    if (code === "auth/weak-password") return "Password must be at least 6 characters.";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
    if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
    return "Something went wrong. Please try again.";
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative" style={{backgroundImage: `url(${require('../images/students.png')})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
         <div className="absolute inset-0 bg-black/70" />
         <div className="relative z-10 w-full flex items-center justify-center">
        <div className="w-full max-w-md">
    
            {/* Logo / Brand */}
            <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white tracking-tight">
                Pathly
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
                Campus safety, smarter.
            </p>
            </div>
    
            {/* Card */}
           <div className="p-8">
    
            {/* Toggle Login / Register */}
            <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
                <button
                onClick={() => { setIsLogin(true); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isLogin
                    ? "bg-red-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
                >
                Sign In
                </button>
                <button
                onClick={() => { setIsLogin(false); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    !isLogin
                    ? "bg-red-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
                >
                Register
                </button>
            </div>
    
            {/* Error Message */}
            {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
                </div>
            )}
    
            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                <label className="block text-sm text-gray-400 mb-1">
                    Email
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@uh.edu"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
                </div>
    
                <div>
                <label className="block text-sm text-gray-400 mb-1">
                    Password
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
                </div>
    
                {/* Confirm Password - only on Register */}
                {!isLogin && (
                <div>
                    <label className="block text-sm text-gray-400 mb-1">
                    Confirm Password
                    </label>
                    <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                    />
                </div>
                )}
    
                <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 mt-2"
                >
                {loading
                    ? "Please wait..."
                    : isLogin
                    ? "Sign In"
                    : "Create Account"}
                </button>
            </form>
    
            {/* Divider */}
            <div className="flex items-center my-5">
                <div className="flex-1 border-t border-gray-700" />
                <span className="px-3 text-gray-500 text-xs">or</span>
                <div className="flex-1 border-t border-gray-700" />
            </div>
    
            {/* Google OAuth */}
            <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold py-2.5 rounded-lg text-sm transition-all duration-200"
            >
                {/* Google Icon */}
                <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Continue with Google
            </button>
    
            {/* UH email note */}
            <p className="text-center text-gray-600 text-xs mt-5">
                UH email verification required at launch
            </p>
            </div>
        </div>
        </div>
        </div>
    );
}