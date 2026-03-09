import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMedication } from '../contexts/MedicationContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Pill, Edit, Trash2, Clock, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';

const pillShapeStyles = {
  round: 'rounded-full aspect-square',
  oval: 'rounded-full aspect-[1.5]',
  capsule: 'rounded-full aspect-[2.5]',
  square: 'rounded-md aspect-square',
};

const frequencyLabels = {
  daily: 'Once Daily',
  twice_daily: 'Twice Daily',
  three_times_daily: '3 Times Daily',
  weekly: 'Weekly',
};

const MedicationsPage = () => {
  const { medications, fetchMedications, deleteMedication, loading } = useMedication();
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setIsDeleting(true);
    try {
      await deleteMedication(deleteId);
      toast.success('Medication deleted successfully');
    } catch (error) {
      toast.error('Failed to delete medication');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading && medications.length === 0) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
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
              My Medications
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Manage your medication list
            </p>
          </div>
          <Link to="/medications/add">
            <Button size="lg" className="h-12" data-testid="add-medication-btn">
              <Plus className="w-5 h-5 mr-2" />
              Add Medication
            </Button>
          </Link>
        </div>

        {/* Medications List */}
        {medications.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <Pill className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Medications Yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by adding your first medication.
            </p>
            <Link to="/medications/add">
              <Button size="lg" data-testid="add-first-medication-btn">
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Medication
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {medications.map((med) => (
              <Card 
                key={med.medication_id} 
                className="p-6 bg-white hover:shadow-md transition-all"
                data-testid={`medication-item-${med.medication_id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Pill Visual */}
                  <div 
                    className={`w-16 h-16 flex items-center justify-center shadow-md flex-shrink-0 ${pillShapeStyles[med.pill_shape]}`}
                    style={{ backgroundColor: med.pill_color }}
                  >
                    <span className="text-white text-lg font-bold opacity-80">
                      {med.name.charAt(0)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-foreground truncate">
                        {med.name}
                      </h3>
                      {med.pills_remaining <= 7 && med.refill_reminder && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs flex-shrink-0">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Low Stock
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg text-muted-foreground font-medium">
                      {med.dosage}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-sm">
                        <Clock className="w-3 h-3 mr-1" />
                        {frequencyLabels[med.frequency] || med.frequency}
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {med.times.join(', ')}
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        <Package className="w-3 h-3 mr-1" />
                        {med.pills_remaining} pills left
                      </Badge>
                    </div>
                    {med.instructions && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {med.instructions}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:ml-auto flex-shrink-0">
                    <Link to={`/medications/edit/${med.medication_id}`}>
                      <Button 
                        variant="outline" 
                        size="lg"
                        className="h-12"
                        data-testid={`edit-medication-${med.medication_id}`}
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="lg"
                      className="h-12 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteId(med.medication_id)}
                      data-testid={`delete-medication-${med.medication_id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this medication and all its history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default MedicationsPage;
