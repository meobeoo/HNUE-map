import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { get, ref, set, push, getDatabase } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyCRD_Jsz7rBhGf2B-oZ4wniLAp8QrglFTQ",
  authDomain: "hnue-map-42e10.firebaseapp.com",
  projectId: "hnue-map-42e10",
  storageBucket: "hnue-map-42e10.appspot.com",
  messagingSenderId: "18471638048",
  appId: "1:18471638048:web:8f538cd825d504c5e49845",
  measurementId: "G-Q43VE2X9Z1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'en';
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

const user = auth.currentUser;

function updateUserProfile(user) {
  const userName = user.displayName;
  const userEmail = user.email;
  const userProfilePicture = user.photoURL;

  document.getElementById("userName").textContent = userName;
  document.getElementById("userName2").textContent = userName;
  document.getElementById("userEmail").textContent = userEmail;
  document.getElementById("userProfilePicture").src = userProfilePicture;
  document.getElementById("userProfilePicture1").src = userProfilePicture;
  document.getElementById("userProfilePicture2").src = userProfilePicture;
}

// Observer for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    updateUserProfile(user);
  } else {
    clearUserProfile();
    window.location.href = "/index.html";
  }
});

// Function to logout
function logout() {
  signOut(auth)
    .then(() => {
      console.log("User signed out");
      clearUserProfile();
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
}

// Function to clear user profile information
function clearUserProfile() {
  document.getElementById("userName").textContent = "";
  document.getElementById("userName2").textContent = "";
  document.getElementById("userEmail").textContent = "";
  document.getElementById("userProfilePicture").src = "";
  document.getElementById("userProfilePicture1").src = "";
  document.getElementById("userProfilePicture2").src = "";
}

document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("logout-btn-1").addEventListener("click", logout);

document.getElementById('post-status').addEventListener('click', async function() {
  try {
    // Get current user
    const user = auth.currentUser;
    const uid = user.uid;

    // Check if the user can post (last post timestamp is more than a day ago)
    const canPost = await canUserPost(uid);

    if (!canPost) {
      alert('Bạn chỉ có thể đăng bài 1 lần mỗi 24h. \nYou can only post once every 24 hours.');
      return;
    }

    // Create a new status reference
    const statusRef = ref(getDatabase(app), 'statuses');
    const newStatusRef = push(statusRef);

    // Initialize variables to save
    let status, address, location, imageURL;

    // Collect status content
    const statusVN = document.getElementById('statusVN').value;
    const statusEng = document.getElementById('statusEng').value;
    status = statusVN;
    if (isDisplayedBlock(document.getElementById('statusEng'))) {
      status = statusEng;
    }

    // Collect address and location (optional)
    const addressVN = document.getElementById('text-address-vn').value;
    const addressEng = document.getElementById('text-address-eng').value;
    const locationVN = document.getElementById('text-location-vn').value;
    const locationEng = document.getElementById('text-location-eng').value;

    address = addressVN;

    if (isDisplayedBlock(document.getElementById('text-address-eng'))) {
      address = addressEng;
    }

    location = locationEng;
    location = locationVN;
  
    // Handle image upload (if any)
    const imageInput = document.getElementById('imageInput');
    if (imageInput.files.length > 0) {
      const imageFile = imageInput.files[0];

      // Create a unique timestamp for the image file name
      const timestamp = new Date().getTime();

      // Create a unique path for the image
      const imagePath = `images/${newStatusRef.key}/${timestamp}_${imageFile.name}`;

      // Create storage reference with the new path
      const storageReference = storageRef(storage, imagePath);

      // Upload the file to storage
      const uploadTask = uploadBytes(storageReference, imageFile);

      // Get the download URL directly from the storage reference
      imageURL = await uploadTask.then(() => getDownloadURL(storageReference));
    }
    
    // Save status data to the database
    const timestamp = new Date().getTime();
    const dataToSave = {
      uid,
      timestamp,
    };

    if (status) dataToSave.status = status;
    if (address) dataToSave.address = address;
    if (location) dataToSave.location = location;
    if (imageURL) dataToSave.imageURL = imageURL;

    if (Object.keys(dataToSave).length > 2) { // At least uid and timestamp are required
      await set(newStatusRef, dataToSave);

      // Display success message if status is updated successfully
      alert('Bạn đã đăng bài thành công! \nStatus posted successfully!');
      document.getElementById('statusVN').value = '';
      document.getElementById('statusEng').value = '';
      document.getElementById('text-location-vn').value = '';
      document.getElementById('text-location-eng').value = '';
      document.getElementById('text-address-vn').value = '';
      document.getElementById('text-address-eng').value = '';
      resetImageInput();
      var enterPost = document.getElementById("enter-post");
      enterPost.style.display = "none";
    }
    await updateLastPostTimestamp(uid);
  } catch (error) {
    // Handle errors
    console.error('Error saving status:', error);
    alert('An error occurred while saving your status. Please try again later.');
  }
});

function resetImageInput() {
  document.getElementById('add-photo').style.backgroundImage = 'url(source-img/add-a-photo.png)';
  document.getElementById('imageInput').value = '';
}
    
// Function to check if an element is displayed as block
function isDisplayedBlock(element) {
  return element.style.display === 'block';
}

async function canUserPost(uid) {
  try {
    // Retrieve the last post timestamp from the user's data
    const lastPostSnapshot = await getDatabaseData(`/users/${uid}/lastPostTimestamp`);
    const lastPostTimestamp = lastPostSnapshot.val();

    if (!lastPostTimestamp) {
      // If no previous timestamp, the user can post
      return true;
    }

    // Check if the last post was more than a day ago
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const currentTime = new Date().getTime();

    return currentTime - lastPostTimestamp > oneDayInMilliseconds;

  } catch (error) {
    console.error('Error checking if user can post:', error);
    return false;
  }
}

async function updateLastPostTimestamp(uid) {
  try {
    // Update the last post timestamp for the user
    const timestamp = new Date().getTime();
    await setDatabaseData(`/users/${uid}/lastPostTimestamp`, timestamp);

  } catch (error) {
    console.error('Error updating last post timestamp:', error);
  }
}

// Helper functions for interacting with Firebase Realtime Database
async function getDatabaseData(path) {
  const snapshot = await get(ref(getDatabase(app), path));
  return snapshot;
}

async function setDatabaseData(path, data) {
  await set(ref(getDatabase(app), path), data);
}