import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ClipboardCheck, Loader2, CheckCircle, Circle, 
  Upload, FileText, AlertCircle 
} from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * DUE DILIGENCE CHECKLIST
 * Interactive, AI-generated deal-specific checklist
 */
export function DueDiligenceChecklist({ dealType, geography, propertyType, dealId }) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState(null);
  const [completedItems, setCompletedItems] = useState(new Set());

  useEffect(() => {
    loadChecklist();
  }, [dealType, geography, propertyType]);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('generateDueDiligenceChecklist', {
        dealType,
        geography,
        propertyType
      });
      setChecklist(response.data);
    } catch (error) {
      console.error('Failed to load checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (categoryIdx, itemIdx) => {
    const key = `${categoryIdx}-${itemIdx}`;
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Critical: 'red',
      High: 'orange',
      Medium: 'yellow',
      Low: 'slate'
    };
    return colors[priority] || 'slate';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </Card>
    );
  }

  const totalItems = checklist?.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0;
  const completedCount = completedItems.size;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            Due Diligence Checklist
          </h3>
          <p className="text-sm text-slate-600">
            {dealType} • {propertyType} • {geography}
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {completedCount} / {totalItems}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Progress</span>
          <span className="text-sm text-slate-600">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {checklist?.categories?.map((category, catIdx) => {
          const categoryCompleted = category.items.filter((_, itemIdx) =>
            completedItems.has(`${catIdx}-${itemIdx}`)
          ).length;

          return (
            <div key={catIdx} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900">{category.name}</h4>
                <Badge variant="secondary">
                  {categoryCompleted} / {category.items.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {category.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isCompleted = completedItems.has(key);

                  return (
                    <div
                      key={itemIdx}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => toggleItem(catIdx, itemIdx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`font-medium ${isCompleted ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>
                              {item.task}
                            </p>
                            <Badge
                              className={`bg-${getPriorityColor(item.priority)}-100 text-${getPriorityColor(item.priority)}-800 flex-shrink-0`}
                            >
                              {item.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>👤 {item.assignee}</span>
                            <span>⏱️ ~{item.estimatedDays} day{item.estimatedDays !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Alert */}
      {progress === 100 && (
        <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Due Diligence Complete!</p>
              <p className="text-sm text-emerald-700">All items have been checked off. Ready to proceed with closing.</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}