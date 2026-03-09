import { useEffect, useState } from 'react';
import { useMedication } from '../contexts/MedicationContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Pill } from 'lucide-react';

const statusConfig = {
  taken: { 
    icon: CheckCircle2, 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-700',
    label: 'Taken'
  },
  missed: { 
    icon: XCircle, 
    bg: 'bg-red-100', 
    text: 'text-red-700',
    label: 'Missed'
  },
  skipped: { 
    icon: Clock, 
    bg: 'bg-amber-100', 
    text: 'text-amber-700',
    label: 'Skipped'
  },
};

const HistoryPage = () => {
  const { history, fetchHistory, loading } = useMedication();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    fetchHistory(100);
  }, [fetchHistory]);

  const formatDate = (dateString) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  // Group history by date
  const groupedHistory = history.reduce((acc, log) => {
    const date = log.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  // Sort dates in descending order
  const sortedDates = Object.keys(groupedHistory).sort((a, b) => 
    new Date(b) - new Date(a)
  );

  // Filter by selected date if different from today
  const filteredDates = sortedDates;

  if (loading && history.length === 0) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
              Medication History
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Track your medication adherence
            </p>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="lg" className="h-12" data-testid="date-filter-btn">
                <CalendarIcon className="w-5 h-5 mr-2" />
                {format(selectedDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date || new Date());
                  setCalendarOpen(false);
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Stats Summary */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {history.filter(h => h.status === 'taken').length}
                  </p>
                  <p className="text-sm text-emerald-600">Taken</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700">
                    {history.filter(h => h.status === 'missed').length}
                  </p>
                  <p className="text-sm text-red-600">Missed</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-700">
                    {history.filter(h => h.status === 'skipped').length}
                  </p>
                  <p className="text-sm text-amber-600">Skipped</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* History List */}
        {history.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <Pill className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No History Yet</h3>
            <p className="text-muted-foreground">
              Your medication history will appear here once you start logging.
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            {filteredDates.map((date) => (
              <div key={date} className="space-y-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  {formatDate(date)}
                </h2>
                <div className="space-y-3 pl-2 border-l-2 border-border">
                  {groupedHistory[date].map((log) => {
                    const config = statusConfig[log.status];
                    const StatusIcon = config.icon;
                    
                    return (
                      <Card 
                        key={log.log_id}
                        className={`p-4 ml-4 border-l-4 ${
                          log.status === 'taken' ? 'border-l-emerald-500' :
                          log.status === 'missed' ? 'border-l-red-500' :
                          'border-l-amber-500'
                        }`}
                        data-testid={`history-item-${log.log_id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                              <StatusIcon className={`w-5 h-5 ${config.text}`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-foreground">{log.medication_name}</h3>
                              <p className="text-sm text-muted-foreground">{log.dosage}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={`${config.bg} ${config.text}`}>
                              {config.label}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              Scheduled: {log.scheduled_time}
                            </p>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {log.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
