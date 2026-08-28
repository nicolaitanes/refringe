// useNotes.js - Notes composable for centralized API and state management
import { ref, reactive, computed, nextTick } from 'vue';

// Shared reactive state
const allNotes = ref([]);

export function useNotes() {
    // Reactive state
    const notes = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const showHidden = ref(false);
    
    // Current context (for filtering notes)
    const context = reactive({
        type: null, // null, 'proposal', 'show', 'user', 'venue'
        proposalid: null,
        showid: null,
        userid: null,
        venueid: null
    });

    // Computed properties
    const filteredNotes = computed(() => {
        return notes.value.filter(note => {
            // Filter by hidden status based on current tab
            return showHidden.value === note.is_hidden;
        });
    });

    const activeNotes = computed(() => notes.value.filter(note => !note.is_hidden));
    const hiddenNotes = computed(() => notes.value.filter(note => note.is_hidden));
    const visibleNotesCount = computed(() => activeNotes.value.length);

    // API calls
    async function makeApiCall(endpoint, data, method='POST') {
        const response = await fetch('/notes'+endpoint, {
            method,
            headers: method !== 'GET' ? {
                'Content-Type': 'application/json'
            } : {},
            body: method !== GET && data ? JSON.stringify(data) : undefined
            params: method === GET ? data ?? {} : {}
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Load notes based on context
    async function loadNotes(contextType = null, { proposalid, showid, userid, venueid } = {}) {
        loading.value = true;
        error.value = null;

        try {
            // Update context
            context.type = contextType;
            context.proposalid = proposalid;
            context.showid = showid;
            context.userid = userid;
            context.venueid = venueid;

            if (!allNotes.value.length) {
                // Load all
                allNotes.value = [{ content: ''}];
                const allNotesResult = await makeApiCall('/', null, GET);
                allNotes.value = Array.isArray(allNotesResult?.notes) ? allNotesResult?.notes : [];
            }

            if (contextType === 'proposal' && proposalid) {
                notes.value = allNotes.value.filter(n => n.proposalid === proposalid);
            } else if (contextType === 'show' && showid) {
                notes.value = allNotes.value.filter(n => n.showid === showid);
            } else if (contextType === 'user' && userid) {
                notes.value = allNotes.value.filter(n => n.userid === userid);
            } else if (contextType === 'venue' && venueid) {
                notes.value = allNotes.value.filter(n => n.venueid === venueid);
            } else {
                notes.value = allNotes.value.filter(n => !n.proposalid && !n.showid);
            }
        } catch (err) {
            error.value = err.message;
            console.error('Error loading notes:', err);
        } finally {
            loading.value = false;
        }
    }

    // Create a new note
    async function createNote(noteData) {
        loading.value = true;
        error.value = null;

        try {
            const payload = {
                content: noteData.content,
                is_visible_to_organizers: noteData.is_visible_to_organizers ?? true,
                is_visible_to_proposers: noteData.is_visible_to_proposers ?? false,
                is_visible_to_public: noteData.is_visible_to_public ?? false,
                is_hidden: noteData.is_hidden ?? false
            };

            // Add context-specific linking
            if (context.proposalid) {
                payload.proposalid = context.proposalid;
            }
            if (context.showid) {
                payload.showid = context.showid;
            }

            const result = await makeApiCall('/', payload);
            
            if (result && result.id) {
                // Reload notes to get the fresh list
                allNotes.value = [];
                await loadNotes(context.type, context.proposalid, context.showid);
                return result;
            }
            
            throw new Error('Failed to create note');
        } catch (err) {
            error.value = err.message;
            console.error('Error creating note:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Update note
    async function updateNote(noteId, noteData) {
        loading.value = true;
        error.value = null;

        try {
            const result = await makeApiCall('/'+noteId, noteData);

            // Update local notes array
            for (const someNotes of [allNotes, notes]) {
                const index = someNotes.value.findIndex(n => n.id == noteId);
                if (index !== -1) {
                    Object.assign(someNotes.value[index], result);
                }
            }
            return true;
        } catch (err) {
            error.value = err.message;
            console.error('Error updating note:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Toggle note visibility flags
    async function toggleNoteFlag(noteId, flagName) {
        const note = notes.value.find(n => n.id == noteId);
        if (!note) return false;

        const currentValue = note[flagName];
        return await updateNote(noteId, { [flagName]: !currentValue });
    }

    // Delete note
    async function deleteNote(noteId) {
        loading.value = true;
        error.value = null;

        try {
            const result = await makeApiCall('/'+noteId, null, 'DELETE');

            // Remove from local array
            for (const someNotes of [allNotes, notes]) {
                const index = someNotes.value.findIndex(n => n.id == noteId);
                if (index !== -1) {
                    someNotes.value.splice(index, 1);
                }
            }
            return true;
        } catch (err) {
            error.value = err.message;
            console.error('Error deleting note:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Helper function to format timestamps
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        } else if (days === 1) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
                   date.toLocaleTimeString('en-US', { 
                       hour: 'numeric', 
                       minute: '2-digit',
                       hour12: true 
                   });
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            }) + ' ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        }
    }

    return {
        // State
        notes,
        loading,
        error,
        showHidden,
        context,
        
        // Computed
        filteredNotes,
        activeNotes,
        hiddenNotes,
        visibleNotesCount,
        
        // Methods
        loadNotes,
        createNote,
        updateNote,
        toggleNoteFlag,
        deleteNote,
        formatTimestamp
    };
}
