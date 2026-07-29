'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import {
  Diamond,
  User,
  Lock,
  Store,
  MapPin,
  FileText,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Camera,
  Upload,
  Key
} from 'lucide-react'
import Link from 'next/link'

export default function AcceptInvitationPage() {
  const { token } = useParams() as { token: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState<any>(null)

  // Onboarding wizard steps: 1 = Credentials, 2 = Store/Address, 3 = KYC/Banking, 4 = Success
  const [step, setStep] = useState(1)

  // Step 1: Credentials
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: Store/Address
  const [storeName, setStoreName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')

  // Step 3: Banking & KYC
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [upi, setUpi] = useState('')
  const [kycType, setKycType] = useState('PAN')
  const [kycNumber, setKycNumber] = useState('')
  const [kycUrl, setKycUrl] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)

  // Registration state
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) {
      verifyInvite()
    }
  }, [token])

  async function verifyInvite() {
    try {
      setLoading(true)
      const res = await fetch(`/api/public/invite?token=${token}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setInvite(data.invite)
        setStoreName(data.invite.recipient_name + ' Designs')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleKycUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingKyc(true)
    try {
      const url = await uploadToCloudinary(files[0])
      setKycUrl(url)
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingKyc(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    setSubmitting(true)

    try {
      const res = await fetch('/api/public/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          username,
          password,
          store_name: storeName,
          city,
          address,
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifsc,
          upi_id: upi,
          kyc_document_type: kycType,
          kyc_document_number: kycNumber,
          kyc_document_url: kycUrl
        })
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setStep(4) // Onboarding success
      }
    } catch (err: any) {
      alert('Registration failed: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-stone-50 font-semibold text-stone-850 shadow-sm'

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center text-white p-4">
        <div className="text-center space-y-3">
          <Diamond className="w-10 h-10 text-amber-500 animate-pulse mx-auto" />
          <p className="text-stone-400 text-sm font-semibold">Verifying your invitation credentials...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-white text-lg font-bold">Invitation Error</h2>
          <p className="text-stone-400 text-sm leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 px-6 rounded-xl transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 p-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Diamond className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Shewah Reseller Network</h2>
        {step < 4 && (
          <p className="text-xs text-stone-450">
            Welcome {invite?.recipient_name}! Let's create your white-label dropship store account.
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-stone-900 py-8 px-4 border border-stone-800 rounded-3xl shadow-2xl sm:px-10 space-y-6">
          {/* Progress tracker */}
          {step < 4 && (
            <div className="flex items-center gap-2 pb-2">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full ${
                    step >= i ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                ></div>
              ))}
            </div>
          )}

          {/* STEP 1: Login credentials */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-800 pb-2">
                <Key className="w-4 h-4 text-stone-500" /> Create Security Login
              </h3>

              <div className="space-y-3.5">
                <div>
                  <label className={lbl}>Choose Username</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-stone-500 text-sm">@</span>
                    <input
                      type="text"
                      className={`${inp} pl-8`}
                      placeholder="e.g. aditi_jewelry"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Select Password</label>
                  <input
                    type="password"
                    className={inp}
                    placeholder="Minimum 8 characters..."
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={lbl}>Confirm Password</label>
                  <input
                    type="password"
                    className={inp}
                    placeholder="Repeat password..."
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if (!username || !password || !confirmPassword) {
                    alert('Please fill out all credential fields.')
                    return
                  }
                  if (password.length < 8) {
                    alert('Password must be at least 8 characters long.')
                    return
                  }
                  if (password !== confirmPassword) {
                    alert('Passwords do not match')
                    return
                  }
                  setStep(2)
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-lg shadow-amber-500/10 mt-3"
              >
                Enter Store Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Store / Profile details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-800 pb-2">
                <Store className="w-4 h-4 text-stone-500" /> Store Profile
              </h3>

              <div className="space-y-3.5">
                <div>
                  <label className={lbl}>Your White-Label Store Name</label>
                  <input
                    type="text"
                    className={inp}
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={lbl}>City</label>
                  <input
                    type="text"
                    className={inp}
                    placeholder="e.g. Mumbai, New Delhi"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={lbl}>Complete Billing Address</label>
                  <textarea
                    className={`${inp} h-24 resize-none`}
                    placeholder="Enter complete billing address..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-stone-850 hover:bg-stone-800/20 text-stone-400 font-bold py-3 rounded-xl text-center text-xs transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (!storeName || !city || !address) {
                      alert('Please fill out all store details.')
                      return
                    }
                    setStep(3)
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-lg shadow-amber-500/10"
                >
                  Banking &amp; KYC <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Banking & KYC uploads */}
          {step === 3 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-800 pb-2">
                <FileText className="w-4 h-4 text-stone-500" /> Banking &amp; KYC Verification
              </h3>

              <div className="space-y-3.5">
                {/* Bank account details */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>Bank Name</label>
                    <input
                      type="text"
                      className={inp}
                      placeholder="e.g. HDFC Bank"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Account Number</label>
                    <input
                      type="text"
                      className={inp}
                      placeholder="e.g. 50100..."
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>IFSC Code</label>
                    <input
                      type="text"
                      className={inp}
                      placeholder="e.g. HDFC00..."
                      value={ifsc}
                      onChange={e => setIfsc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={lbl}>UPI Address ID</label>
                    <input
                      type="text"
                      className={inp}
                      placeholder="e.g. name@upi"
                      value={upi}
                      onChange={e => setUpi(e.target.value)}
                    />
                  </div>
                </div>

                {/* KYC Info */}
                <div className="pt-2 border-t border-stone-800 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className={lbl}>KYC Doc Type</label>
                      <select
                        className={inp}
                        value={kycType}
                        onChange={e => setKycType(e.target.value)}
                      >
                        <option value="PAN">PAN Card</option>
                        <option value="Aadhaar">Aadhaar</option>
                        <option value="GST">GSTIN</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Document Number</label>
                      <input
                        type="text"
                        className={inp}
                        placeholder="Enter ID number..."
                        value={kycNumber}
                        onChange={e => setKycNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Upload Document File Proof</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 border border-stone-850 bg-stone-900 text-stone-300 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer hover:bg-stone-800 transition-colors shadow-sm">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e => handleKycUpload(e.target.files)}
                          disabled={uploadingKyc}
                        />
                        <Upload className="w-4 h-4 text-stone-400" /> Select Document
                      </label>
                      <span className="text-[10px] text-stone-500 font-semibold truncate max-w-[120px]">
                        {uploadingKyc ? 'Uploading...' : kycUrl ? 'File uploaded!' : 'No file selected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 border border-stone-850 hover:bg-stone-800/20 text-stone-400 font-bold py-3 rounded-xl text-center text-xs transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingKyc}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors shadow-lg shadow-green-500/10 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Registration Success */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h3 className="text-white text-lg font-bold">Onboarding Submitted!</h3>
              <p className="text-stone-400 text-xs leading-relaxed">
                Your reseller profile and security credentials have been created successfully.
                Our administrator is currently verifying your KYC credentials. Once approved, you will receive a confirmation alert on WhatsApp to log in.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 px-8 rounded-xl transition-colors shadow-lg"
                >
                  Go to Login Screen
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
