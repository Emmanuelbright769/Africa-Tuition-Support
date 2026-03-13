import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, Search, CheckCircle2, AlertCircle, TrendingUp, Building2, ChevronRight } from "lucide-react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("students");

  const pendingStudents = [
    { id: "STU-001", name: "David Ochieng", country: "Kenya", waec: "5 A's", tier: "Gold", status: "Pending Verification" },
    { id: "STU-002", name: "Sarah Mensah", country: "Ghana", waec: "7 A's", tier: "Platinum", status: "Pending Verification" },
    { id: "STU-003", name: "Emmanuel Ade", country: "Nigeria", waec: "Pass", tier: "Silver", status: "Pending Verification" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="w-8 h-8 bg-tsia-green rounded flex items-center justify-center mr-3">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-lg font-bold text-white tracking-wide">TSIA Admin</span>
        </div>
        <div className="p-4 space-y-2 flex-1">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <TrendingUp className="w-4 h-4" /> Overview
          </button>
          <button 
            onClick={() => setActiveTab("students")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'students' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Verify Students
            <Badge className="ml-auto bg-tsia-green hover:bg-tsia-green">3</Badge>
          </button>
          <button 
            onClick={() => setActiveTab("payouts")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'payouts' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <DollarSign className="w-4 h-4" /> Process Payouts
          </button>
          <button 
            onClick={() => setActiveTab("cohorts")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cohorts' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Building2 className="w-4 h-4" /> Leadership Cohorts
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-semibold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search ID or name..." className="pl-9 h-9 w-64 bg-slate-50 border-slate-200" />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-6">
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">+12% this week</span>
                </div>
                <h3 className="text-slate-500 text-sm font-medium mb-1">Total Verified Students</h3>
                <div className="text-3xl font-bold text-slate-900">1,248</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-tsia-green/20 text-tsia-green flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">Processing: $4k</span>
                </div>
                <h3 className="text-slate-500 text-sm font-medium mb-1">Total Payouts (YTD)</h3>
                <div className="text-3xl font-bold text-slate-900">$342,500</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Requires Action</span>
                </div>
                <h3 className="text-slate-500 text-sm font-medium mb-1">Pending Verifications</h3>
                <div className="text-3xl font-bold text-slate-900">24</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-slate-500 text-sm font-medium mb-1">Active Leadership Cohorts</h3>
                <div className="text-3xl font-bold text-slate-900">8</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Action Area */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Student Verification Queue</CardTitle>
                <Button size="sm" variant="outline">Filter <ChevronRight className="w-4 h-4 ml-1"/></Button>
              </div>
            </CardHeader>
            <div className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-600">Student</TableHead>
                    <TableHead className="font-semibold text-slate-600">Country</TableHead>
                    <TableHead className="font-semibold text-slate-600">Academic Docs</TableHead>
                    <TableHead className="font-semibold text-slate-600">Calculated Tier</TableHead>
                    <TableHead className="font-semibold text-slate-600">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{student.name}</div>
                        <div className="text-xs text-slate-500">{student.id}</div>
                      </TableCell>
                      <TableCell>{student.country}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-sm">{student.waec}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          student.tier === 'Platinum' ? 'bg-slate-100 text-slate-800 border-slate-300' :
                          student.tier === 'Gold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }>
                          {student.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending Review
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800">Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Payout SLA Reminder</h4>
              <p className="text-sm text-blue-800 mt-1">
                Approved sponsorships must be credited to student digital wallets within <strong>24-48 hours</strong>. 
                There are currently 0 pending payouts nearing the SLA limit.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}