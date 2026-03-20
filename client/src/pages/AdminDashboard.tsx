import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Users, DollarSign, Search, CheckCircle2, AlertCircle, TrendingUp, Building2, Wallet, FileText, LogOut, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function ClockIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [selectedDisbursement, setSelectedDisbursement] = useState<any>(null);
  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: stats } = useQuery({ queryKey: ["/api/admin/stats"] });
  const { data: pendingVerifications = [] } = useQuery({ queryKey: ["/api/admin/pending-verifications"] });
  const { data: pendingDisbursements = [] } = useQuery({ queryKey: ["/api/admin/pending-disbursements"] });
  const { data: allStudents = [] } = useQuery({ queryKey: ["/api/admin/students"] });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/verify/${id}`, { approve });
      return res.json();
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setSelectedVerification(null);
      toast({ title: approve ? "Student Approved" : "Application Rejected", description: approve ? "Student has been verified successfully." : "The application has been rejected." });
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/process-disbursement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setSelectedDisbursement(null);
      toast({ title: "Payout Processed", description: "Funds have been credited to the student's wallet." });
    },
  });

  const handleLogout = async () => { await logout(); setLocation("/"); };

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") { redirectTimerRef.current = setTimeout(() => setLocation("/login"), 200); }
    else if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, [authLoading, user]);

  if (authLoading || (!user && !authLoading)) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;

  const contentVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }, exit: { opacity: 0, y: -20, transition: { duration: 0.3 } } };

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
            { id: "students", icon: Users, label: "Applications", badge: (pendingVerifications as any[]).length },
            { id: "payouts", icon: DollarSign, label: "Disbursements", badge: (pendingDisbursements as any[]).length },
            { id: "all-students", icon: FileText, label: "All Students" },
            { id: "cohorts", icon: Building2, label: "Cohorts" }
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-tsia-green/10 text-tsia-green border border-tsia-green/20' : 'hover:bg-slate-900 hover:text-white border border-transparent'}`}
            >
              <item.icon className="w-4 h-4" /> {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <Badge className={`ml-auto ${activeTab === item.id ? 'bg-tsia-green' : 'bg-slate-800 text-slate-300 hover:bg-slate-800'}`}>{item.badge}</Badge>
              )}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800">
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-900" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <h1 className="text-xl font-semibold text-slate-900 capitalize flex items-center gap-2">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search records..." className="pl-9 h-9 w-64 bg-slate-100/50 border-slate-200 rounded-full" />
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold shadow-md cursor-pointer">AD</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div key="overview" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { title: "Total Students", value: stats?.totalStudents ?? 0, icon: Users, color: "blue" },
                    { title: "Pending Verifications", value: stats?.pendingVerifications ?? 0, icon: AlertCircle, color: "amber" },
                    { title: "Pending Payouts", value: stats?.pendingDisbursements ?? 0, icon: DollarSign, color: "green" },
                    { title: "Active Cohorts", value: "8", icon: Building2, color: "purple" }
                  ].map((stat, i) => (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i}>
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <CardContent className="p-6 relative">
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center shadow-inner`}>
                              <stat.icon className="w-6 h-6" />
                            </div>
                          </div>
                          <h3 className="text-slate-500 text-sm font-medium mb-1">{stat.title}</h3>
                          <div className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-2 shadow-sm border-0">
                    <CardHeader><CardTitle className="text-lg">Recent Verification Requests</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(pendingVerifications as any[]).slice(0, 3).map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-white">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">
                                {v.user?.firstName?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-900">{v.user?.firstName} {v.user?.lastName}</p>
                                <p className="text-xs text-slate-500">{v.user?.email}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setActiveTab('students')}>View <ArrowRight className="w-4 h-4 ml-1" /></Button>
                          </div>
                        ))}
                        {(pendingVerifications as any[]).length === 0 && <p className="text-sm text-slate-500 text-center py-4">No pending verifications.</p>}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-0">
                    <CardHeader><CardTitle className="text-lg">SLA Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-5 mb-4">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4" /> Payout SLA (24-48h)</h4>
                        <p className="text-sm text-green-800">Payouts are processed within the SLA window.</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                        <h4 className="font-semibold text-amber-900 flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4" /> Queue</h4>
                        <p className="text-sm text-amber-800">{(pendingVerifications as any[]).length} verification(s) and {(pendingDisbursements as any[]).length} payout(s) pending.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === "students" && (
              <motion.div key="students" variants={contentVariants} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-lg">Application Verification Queue</CardTitle>
                    <CardDescription>Review student identity and academic records.</CardDescription>
                  </CardHeader>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-600 py-4 px-6">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600">NIN</TableHead>
                          <TableHead className="font-semibold text-slate-600">WAEC</TableHead>
                          <TableHead className="font-semibold text-slate-600">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600">Fee Paid</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pendingVerifications as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No pending applications.</TableCell></TableRow>
                        ) : (pendingVerifications as any[]).map((v: any) => (
                          <TableRow key={v.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-slate-900">{v.user?.firstName} {v.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{v.user?.email}</div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{v.nin || '-'}</TableCell>
                            <TableCell>
                              {v.waecRegNumber ? (
                                <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-md inline-flex w-fit">
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="text-xs font-medium text-slate-700">{v.waecRegNumber}</span>
                                </div>
                              ) : <span className="text-slate-400">-</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${v.tier === 'platinum' ? 'bg-slate-800 text-white border-slate-800' : v.tier === 'gold' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
                                {v.tier?.charAt(0).toUpperCase() + v.tier?.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>{v.portalFeePaid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <span className="text-slate-400">No</span>}</TableCell>
                            <TableCell className="text-right px-6">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800 shadow-sm" onClick={() => setSelectedVerification(v)} data-testid={`button-review-${v.id}`}>
                                    Review
                                  </Button>
                                </DialogTrigger>
                                {selectedVerification?.id === v.id && (
                                  <DialogContent className="sm:max-w-[600px]">
                                    <DialogHeader>
                                      <DialogTitle>Review: {v.user?.firstName} {v.user?.lastName}</DialogTitle>
                                      <DialogDescription>Verify documents and approve the student.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-2 gap-6 py-4">
                                      <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identity</h4>
                                        <p className="text-sm"><strong>NIN:</strong> {v.nin || 'Not provided'}</p>
                                        <p className="text-sm"><strong>Country:</strong> {v.user?.country}</p>
                                        <p className="text-sm"><strong>Phone:</strong> {v.user?.phone}</p>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Academic</h4>
                                        <p className="text-sm"><strong>WAEC Reg:</strong> {v.waecRegNumber || 'Not provided'}</p>
                                        <p className="text-sm"><strong>Year:</strong> {v.waecYear || '-'}</p>
                                        <p className="text-sm"><strong>Grades:</strong> {v.waecGrades || '-'}</p>
                                        <p className="text-sm"><strong>Tier:</strong> {v.tier}</p>
                                      </div>
                                    </div>
                                    <DialogFooter className="flex justify-between sm:justify-between border-t pt-4">
                                      <Button variant="destructive" onClick={() => verifyMutation.mutate({ id: v.id, approve: false })} disabled={verifyMutation.isPending} data-testid="button-reject">
                                        Reject
                                      </Button>
                                      <Button className="bg-tsia-green hover:bg-tsia-green/90" onClick={() => verifyMutation.mutate({ id: v.id, approve: true })} disabled={verifyMutation.isPending} data-testid="button-approve">
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
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0"><AlertCircle className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-semibold text-blue-900">SLA Requirement Active</h4>
                    <p className="text-sm text-blue-800/80 mt-1">Process all approved sponsorships to student wallets within <strong>24-48 hours</strong>.</p>
                  </div>
                </div>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6"><CardTitle className="text-lg">Pending Disbursements</CardTitle></CardHeader>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-600 py-4 px-6">ID</TableHead>
                          <TableHead className="font-semibold text-slate-600">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600">Requested</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pendingDisbursements as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No pending payouts.</TableCell></TableRow>
                        ) : (pendingDisbursements as any[]).map((d: any) => (
                          <TableRow key={d.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-500">DIS-{d.id}</TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{d.user?.firstName} {d.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{d.user?.email}</div>
                            </TableCell>
                            <TableCell className="font-bold text-slate-900">${parseFloat(d.amount).toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-slate-600">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right px-6">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => setSelectedDisbursement(d)} data-testid={`button-process-${d.id}`}>
                                    Process
                                  </Button>
                                </DialogTrigger>
                                {selectedDisbursement?.id === d.id && (
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Confirm Payout</DialogTitle>
                                      <DialogDescription>Transfer funds to the student's digital wallet.</DialogDescription>
                                    </DialogHeader>
                                    <div className="bg-slate-50 rounded-xl p-6 border my-4 space-y-4">
                                      <div className="flex justify-between items-center border-b pb-4">
                                        <span className="text-sm text-slate-500">Recipient</span>
                                        <span className="font-medium">{d.user?.firstName} {d.user?.lastName}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500">Transfer Amount</span>
                                        <span className="text-2xl font-bold text-slate-900">${parseFloat(d.amount).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline">Cancel</Button>
                                      <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => disburseMutation.mutate(d.id)} disabled={disburseMutation.isPending} data-testid="button-execute-transfer">
                                        <Wallet className="w-4 h-4 mr-2" /> {disburseMutation.isPending ? "Processing..." : "Execute Transfer"}
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

            {activeTab === "all-students" && (
              <motion.div key="all-students" variants={contentVariants} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-lg">All Registered Students</CardTitle>
                    <CardDescription>{(allStudents as any[]).length} total student records.</CardDescription>
                  </CardHeader>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-600 py-4 px-6">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600">Country</TableHead>
                          <TableHead className="font-semibold text-slate-600">Verification</TableHead>
                          <TableHead className="font-semibold text-slate-600">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600">Plan</TableHead>
                          <TableHead className="font-semibold text-slate-600">Wallet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allStudents as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No students registered yet.</TableCell></TableRow>
                        ) : (allStudents as any[]).map((s: any) => (
                          <TableRow key={s.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-slate-900">{s.firstName} {s.lastName}</div>
                              <div className="text-xs text-slate-500">{s.email}</div>
                            </TableCell>
                            <TableCell>{s.country}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${s.verification?.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' : s.verification?.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : s.verification?.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-500'}`}>
                                {s.verification?.status || 'Not started'}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{s.verification?.tier || '-'}</TableCell>
                            <TableCell>{s.plan ? `${s.plan.planYears}yr` : '-'}</TableCell>
                            <TableCell className="font-medium">${parseFloat(s.wallet?.balance || '0').toFixed(2)}</TableCell>
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
                  <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6"><Building2 className="w-10 h-10 text-purple-600" /></div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Leadership Cohorts</h3>
                  <p className="text-slate-500 mb-6">Manage enterprise and corporate sponsorships of 100+ students.</p>
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
