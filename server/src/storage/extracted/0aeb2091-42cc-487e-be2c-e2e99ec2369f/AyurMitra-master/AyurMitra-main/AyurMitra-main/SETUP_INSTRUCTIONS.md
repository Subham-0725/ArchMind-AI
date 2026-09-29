# Ayurveda Management System - Setup Instructions

## 🔑 Requirements Implementation

This project implements a complete booking and doctor dashboard system with the following features:

### ✅ Implemented Features

1. **Patient Profile Form** - Stores patient info in localStorage
2. **Appointment Booking** - Saves appointments with patient + doctor details
3. **Doctor Login with Clerk** - Username/password authentication
4. **Dynamic Doctor Dashboard** - Shows appointments filtered by doctorId
5. **Automatic Redirect** - Redirects to `/doctor/:doctorId` after login

## 📋 Setup Instructions

### 1. Clerk Configuration

#### Create Doctor Accounts in Clerk Dashboard:

1. Go to your Clerk Dashboard
2. Navigate to Users section
3. Create accounts for doctors using emails from CSV:
   - `vaidya.gopal.menon@ayurveda.com` (Doctor ID: 1)
   - `vaidya.nisha.bhat@ayurveda.com` (Doctor ID: 2)
   - `vaidya.priya.nair@ayurveda.com` (Doctor ID: 3)
   - `vaidya.deepak.shukla@ayurveda.com` (Doctor ID: 4)
   - etc.

#### Set Public Metadata for Each Doctor:

1. Select a doctor user in Clerk Dashboard
2. Go to "Metadata" tab
3. Add to "Public metadata":
```json
{
  "doctorId": "2"
}
```

### 2. Testing the System

#### Option 1: Use Demo Data
1. Navigate to `/demo` in your browser
2. Click "Create Demo Data" 
3. This creates sample patient profile and appointments in localStorage

#### Option 2: Manual Testing
1. Go to `/patient-profile` and fill out patient information
2. Go to `/appointment-booking` and search symptoms
3. Select a doctor and click "Book Appointment"

### 3. Doctor Login Flow

1. Create doctor account in Clerk with email: `vaidya.nisha.bhat@ayurveda.com`
2. Set publicMetadata: `{"doctorId": "2"}`
3. Go to `/doctor-login`
4. Login with the doctor credentials
5. Should automatically redirect to `/doctor/2`
6. Dashboard shows appointments filtered for doctorId "2"

## 📊 Data Structure

### Patient Profile (localStorage: 'patientProfile')
```json
{
  "name": "John Doe",
  "age": "35",
  "phone": "9876543210", 
  "address": "123 Main Street, Delhi",
  "gender": "male",
  "bloodGroup": "O+",
  "emergencyContact": "9876543211",
  "medicalHistory": "No major medical history"
}
```

### Appointments (localStorage: 'appointments')
```json
[
  {
    "doctorId": "2",
    "doctorName": "Vaidya Nisha Bhat",
    "patientName": "John Doe", 
    "age": "35",
    "phone": "9876543210",
    "address": "123 Main Street, Delhi",
    "symptoms": "migraine, stuffy nose",
    "appointmentDate": "2024-01-15T10:30:00.000Z",
    "status": "pending"
  }
]
```

## 🔄 Complete User Flow

### Patient Booking Flow:
1. Patient fills profile form → stored in localStorage
2. Patient searches symptoms → finds matching doctors from CSV
3. Patient clicks "Book Appointment" → appointment saved to localStorage
4. Appointment includes: patient info + symptoms + doctorId + doctorName

### Doctor Dashboard Flow:
1. Doctor logs in via Clerk → gets doctorId from publicMetadata
2. Redirects to `/doctor/:doctorId` 
3. Dashboard loads appointments from localStorage
4. Filters appointments by doctorId
5. Doctor can update appointment status (pending/confirmed/completed/cancelled)

## 🛠 Key Files Modified

- `AppointmentBooking.jsx` - Added appointment saving to localStorage
- `DoctorLogin.jsx` - Added Clerk authentication with redirect
- `DoctorDashboard.jsx` - Made dynamic with doctorId filtering
- `App.jsx` - Added dynamic route `/doctor/:doctorId`

## 🚀 Next Steps (Future API Integration)

When ready to replace localStorage with backend APIs:

1. Replace `localStorage.getItem('appointments')` with API calls
2. Replace `localStorage.setItem('appointments')` with POST/PUT requests
3. Add authentication middleware to protect doctor routes
4. Implement real-time updates with WebSockets

## 📝 Notes

- All data is currently stored in localStorage (frontend-only)
- Doctor information is loaded from the CSV file
- Clerk handles authentication and user management
- The system is fully functional for testing and demo purposes
- Ready for backend integration when needed

## 🧪 Testing Checklist

- [ ] Patient can fill profile form
- [ ] Patient can search symptoms and find doctors
- [ ] Patient can book appointments
- [ ] Appointments are saved to localStorage
- [ ] Doctor can login via Clerk
- [ ] Doctor redirects to correct dashboard URL
- [ ] Doctor sees only their appointments
- [ ] Doctor can update appointment status
- [ ] Multiple doctors can have separate dashboards