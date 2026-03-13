import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Users, DollarSign, Search, CheckCircle2, AlertCircle, TrendingUp, Building2, ChevronRight, XCircle, Wallet, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const initialStudents = [
  { id: "STU-001", name: "David Ochieng", country: "Kenya", waec: "5 A's", tier: "Gold", status: "Pending Verification", date: "2023-10-12" },
  { id: "STU-002", name: "Sarah Mensah", country: "Ghana", waec: "7 A's", tier: "Platinum", status: "Pending Verification", date: "2023-10-12" },
  { id: "STU-003", name: "Emmanuel Ade", country: "Nigeria", waec: "Pass", tier: "Silver", status: "Pending Verification", date: "2023-10-11" },
];

const initialDisbursements = [
  { id: "DIS-001", studentId: "STU-105", name: "Grace Kiprono", amount: 230, plan: "1 Year", status: "Pending", requestedOn: "2023-10-13" },
  { id: "DIS-002", studentId: "STU-209", name: "Ahmed Diallo", amount: 460, plan: "2 Year", status: "Pending", requestedOn: "2023-10-12" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState(initialStudents);
  const [disbursements, setDisbursements] = useState(initialDisbursements);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedDisbursement, setSelectedDisbursement] = useState<any>(null);

  const handleVerifyStudent = (id: string, approve: boolean) => {
    setStudents(students.filter(s => s.id !== id));
    setSelectedStudent(null);
  };

  const handleProcessDisbursement = (id: string) => {
    setDisbursements(disbursements.filter(d => d.id !== id));
    setSelectedDisbursement(null);
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 text-slate-300 flex-shrink-0 flex flex-col hidden md:flex border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 bg-tsia-green rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-tsia-green/20">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-lg font-bold text-white tracking-wide">TSIA Admin</span>
        </div>
        <div className="p-4 space-y-1.5 flex-1">
          {[
            { id: "overview", icon: TrendingUp, label: "Overview" },
            { id: "students", icon: Users, label: "Applications", badge: students.length },
            { id: "payouts", icon: DollarSign, label: "Disbursements", badge: disbursements.length },
            { id: "cohorts", icon: Building2, label: "Cohorts" }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-tsia-green/10 text-tsia-green border border-tsia-green/20' 
                : 'hover:bg-slate-900 hover:text-white border border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4" /> {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <Badge className={`ml-auto ${activeTab === item.id ? 'bg-tsia-green' : 'bg-slate-800 text-slate-300 hover:bg-slate-800'}`}>
                  {item.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <h1 className="text-xl font-semibold text-slate-900 capitalize flex items-center gap-2">
            {activeTab.replace('-', ' ')}
          </h1>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search records..." className="pl-9 h-9 w-64 bg-slate-100/50 border-slate-200 rounded-full focus-visible:ring-tsia-green" />
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold shadow-md cursor-pointer hover:bg-slate-800 transition-colors">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div key="overview" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { title: "Total Verified Students", value: "1,248", icon: Users, color: "blue", trend: "+12%" },
                    { title: "Total Payouts (YTD)", value: "$342,500", icon: Wallet, color: "green", trend: "+$4k" },
                    { title: "Pending Verifications", value: students.length.toString(), icon: AlertCircle, color: "amber", trend: "Action" },
                    { title: "Active Cohorts", value: "8", icon: Building2, color: "purple", trend: "Stable" }
                  ].map((stat, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i}
                    >
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <CardContent className="p-6 relative">
                          <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-100 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110 opacity-50`}></div>
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center shadow-inner`}>
                              <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{stat.trend}</span>
                          </div>
                          <h3 className="text-slate-500 text-sm font-medium mb-1 relative z-10">{stat.title}</h3>
                          <div className="text-3xl font-bold text-slate-900 tracking-tight relative z-10">{stat.value}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Dashboard Charts/Lists Mockup */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-2 shadow-sm border-0">
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Verification Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {students.slice(0, 3).map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-white">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-900">{s.name}</p>
                                <p className="text-xs text-slate-500">{s.id} • {s.country}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setActiveTab('students')}>View <ArrowRight className="w-4 h-4 ml-1" /></Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-sm border-0">
                    <CardHeader>
                      <CardTitle className="text-lg">SLA Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-5 mb-4">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4" /> Payout SLA (24-48h)
                        </h4>
                        <p className="text-sm text-green-800">98% of payouts are meeting the 48-hour SLA requirement.</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                        <h4 className="font-semibold text-amber-900 flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4" /> Verification Queue
                        </h4>
                        <p className="text-sm text-amber-800">{students.length} applications waiting &gt; 24h.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === "students" && (
              <motion.div key="students" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white flex flex-row items-center justify-between py-4 px-6">
                    <div>
                      <CardTitle className="text-lg">Application Queue</CardTitle>
                      <CardDescription>Verify student identity and academic records.</CardDescription>
                    </div>
                  </CardHeader>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-600 py-4 px-6">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600">Country</TableHead>
                          <TableHead className="font-semibold text-slate-600">Academic Docs</TableHead>
                          <TableHead className="font-semibold text-slate-600">Calculated Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600">Applied Date</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">No pending applications.</TableCell>
                          </TableRow>
                        ) : students.map((student) => (
                          <TableRow key={student.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-slate-900">{student.name}</div>
                              <div className="text-xs text-slate-500">{student.id}</div>
                            </TableCell>
                            <TableCell>{student.country}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-md inline-flex w-fit">
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs font-medium text-slate-700">{student.waec}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`
                                ${student.tier === 'Platinum' ? 'bg-slate-800 text-white border-slate-800' : ''}
                                ${student.tier === 'Gold' ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}
                                ${student.tier === 'Silver' ? 'bg-slate-200 text-slate-800 border-slate-300' : ''}
                              `}>
                                {student.tier}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{student.date}</TableCell>
                            <TableCell className="text-right px-6">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800 shadow-sm" onClick={() => setSelectedStudent(student)}>
                                    Review Docs
                                  </Button>
                                </DialogTrigger>
                                {selectedStudent && selectedStudent.id === student.id && (
                                  <DialogContent className="sm:max-w-[600px]">
                                    <DialogHeader>
                                      <DialogTitle>Review Application: {selectedStudent.name}</DialogTitle>
                                      <DialogDescription>Verify the submitted documents and approve the academic tier.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-2 gap-6 py-4">
                                      <div className="space-y-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border">
                                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identity Info</h4>
                                          <p className="text-sm"><strong>NIN:</strong> 12345678901</p>
                                          <p className="text-sm"><strong>Country:</strong> {selectedStudent.country}</p>
                                          <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
                                            <CheckCircle2 className="w-4 h-4" /> NIN Verified via API
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border">
                                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Academic Info</h4>
                                          <p className="text-sm"><strong>WAEC Scores:</strong> {selectedStudent.waec}</p>
                                          <p className="text-sm"><strong>Calculated Tier:</strong> {selectedStudent.tier}</p>
                                          <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs">
                                            <FileText className="w-3 h-3 mr-1" /> View Uploaded Result
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    <DialogFooter className="flex justify-between sm:justify-between border-t pt-4">
                                      <Button variant="destructive" onClick={() => handleVerifyStudent(student.id, false)}>
                                        Reject Application
                                      </Button>
                                      <Button className="bg-tsia-green hover:bg-tsia-green/90" onClick={() => handleVerifyStudent(student.id, true)}>
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Verify
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                )}
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === "payouts" && (
              <motion.div key="payouts" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900">SLA Requirement Active</h4>
                    <p className="text-sm text-blue-800/80 mt-1 leading-relaxed">
                      Approved sponsorships must be disbursed to student wallets within 24-48 hours. Ensure adequate funding pool balance before processing batches.
                    </p>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Pool Balance</span>
                    <span className="text-2xl font-bold text-blue-900">$1,240,500</span>
                  </div>
                </div>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-lg">Pending Disbursements</CardTitle>
                  </CardHeader>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-600 py-4 px-6">Transaction ID</TableHead>
                          <TableHead className="font-semibold text-slate-600">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600">Plan</TableHead>
                          <TableHead className="font-semibold text-slate-600">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600">Time in Queue</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disbursements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">No pending payouts.</TableCell>
                          </TableRow>
                        ) : disbursements.map((disb) => (
                          <TableRow key={disb.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-500">{disb.id}</TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{disb.name}</div>
                              <div className="text-xs text-slate-500">{disb.studentId}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100">{disb.plan}</Badge>
                            </TableCell>
                            <TableCell className="font-bold text-slate-900">${disb.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium bg-amber-100/50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> 18 hours
                              </span>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setSelectedDisbursement(disb)}>
                                    Process
                                  </Button>
                                </DialogTrigger>
                                {selectedDisbursement && selectedDisbursement.id === disb.id && (
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Confirm Disbursement</DialogTitle>
                                      <DialogDescription>Authorize the transfer of funds to the student's digital wallet.</DialogDescription>
                                    </DialogHeader>
                                    <div className="bg-slate-50 rounded-xl p-6 border my-4 space-y-4">
                                      <div className="flex justify-between items-center border-b pb-4">
                                        <span className="text-sm text-slate-500">Recipient</span>
                                        <span className="font-medium">{selectedDisbursement.name} ({selectedDisbursement.studentId})</span>
                                      </div>
                                      <div className="flex justify-between items-center border-b pb-4">
                                        <span className="text-sm text-slate-500">Sponsorship Plan</span>
                                        <span className="font-medium">{selectedDisbursement.plan} Commitment</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500">Transfer Amount</span>
                                        <span className="text-2xl font-bold text-slate-900">${selectedDisbursement.amount.toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline">Cancel</Button>
                                      <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleProcessDisbursement(disb.id)}>
                                        <Wallet className="w-4 h-4 mr-2" /> Execute Transfer
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                )}
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === "cohorts" && (
              <motion.div key="cohorts" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="flex items-center justify-center h-[60vh]">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Building2 className="w-10 h-10 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Leadership Cohorts</h3>
                  <p className="text-slate-500 mb-6">Manage enterprise and corporate sponsorships of 100+ students. View cohort reports and funding utilization.</p>
                  <Button variant="outline">Create New Cohort</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Simple clock icon component for use in the file
function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}